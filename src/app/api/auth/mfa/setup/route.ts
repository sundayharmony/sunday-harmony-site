import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireStaffMfaBootstrapSession } from '@/lib/mfa-session'
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpSecret,
  totpQrDataUrl,
  verifyTotpCode,
} from '@/lib/mfa-totp'
import { getSupabase } from '@/lib/supabase'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Start MFA enrollment — returns QR + secret once; secret stored encrypted pending confirm. */
export async function POST(req: NextRequest) {
  const session = await requireStaffMfaBootstrapSession()
  if (session instanceof NextResponse) return session

  const ip = getClientIp(req)
  const rl = await rateLimitDurable(`mfa-setup:${session.user.id}`, 10, 15 * 60 * 1000)
  if (!rl.allowed) return rateLimitResponse(rl.resetIn)

  const { data: row } = await getSupabase()
    .from('users')
    .select('totp_enabled')
    .eq('id', session.user.id)
    .single()

  if (row?.totp_enabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 })
  }

  const secret = generateTotpSecret()
  const encrypted = encryptTotpSecret(secret)
  const { error } = await getSupabase()
    .from('users')
    .update({
      totp_secret_encrypted: encrypted,
      totp_enabled: false,
      totp_backup_hashes: null,
    })
    .eq('id', session.user.id)

  if (error) {
    console.error('MFA setup start error:', error)
    return NextResponse.json({ error: 'Could not start MFA setup' }, { status: 500 })
  }

  const account = session.user.email || session.user.name || 'staff'
  const qrDataUrl = await totpQrDataUrl(secret, account)

  return NextResponse.json({
    secret,
    qrDataUrl,
    otpauth: `otpauth://totp/Sunday%20Harmony:${encodeURIComponent(account)}?secret=${secret}&issuer=Sunday%20Harmony`,
  })
}

/** Confirm enrollment with a live TOTP code; enables MFA and returns backup codes once. */
export async function PUT(req: NextRequest) {
  const session = await requireStaffMfaBootstrapSession()
  if (session instanceof NextResponse) return session

  const rl = await rateLimitDurable(`mfa-confirm:${session.user.id}`, 10, 15 * 60 * 1000)
  if (!rl.allowed) return rateLimitResponse(rl.resetIn)

  const body = await req.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code : ''

  const { data: row, error } = await getSupabase()
    .from('users')
    .select('email,totp_secret_encrypted,totp_enabled')
    .eq('id', session.user.id)
    .single()

  if (error || !row?.totp_secret_encrypted) {
    return NextResponse.json({ error: 'Start MFA setup first' }, { status: 400 })
  }
  if (row.totp_enabled) {
    return NextResponse.json({ error: 'MFA is already enabled' }, { status: 400 })
  }

  const secret = decryptTotpSecret(row.totp_secret_encrypted)
  if (!secret || !verifyTotpCode(secret, code, row.email)) {
    return NextResponse.json({ error: 'Invalid authenticator code' }, { status: 400 })
  }

  const backups = generateBackupCodes()
  const { error: upErr } = await getSupabase()
    .from('users')
    .update({
      totp_enabled: true,
      totp_backup_hashes: backups.hashes,
      totp_verified_at: new Date().toISOString(),
    })
    .eq('id', session.user.id)

  if (upErr) {
    console.error('MFA confirm error:', upErr)
    return NextResponse.json({ error: 'Could not enable MFA' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    backupCodes: backups.plain,
    message: 'MFA enabled. Save your backup codes — they will not be shown again.',
  })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data } = await getSupabase()
    .from('users')
    .select('totp_enabled,totp_verified_at')
    .eq('id', session.user.id)
    .single()

  return NextResponse.json({
    totpEnabled: Boolean(data?.totp_enabled),
    totpVerifiedAt: data?.totp_verified_at || null,
    mfaVerified: Boolean(session.user.mfaVerified),
    mfaPending: Boolean(session.user.mfaPending),
    mfaEnrollmentRequired: Boolean(session.user.mfaEnrollmentRequired),
  })
}
