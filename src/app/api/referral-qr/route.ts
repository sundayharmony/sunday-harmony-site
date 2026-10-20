import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { logApiRouteError } from '@/lib/api-route-log'
import { authOptions } from '@/lib/auth'
import { getClientIdFromSession, requireClientSession } from '@/lib/client-auth'
import { requirePartnerSession } from '@/lib/partner-auth'
import { resolveCreditFundingStaffAccess } from '@/lib/stripe-admin-auth'
import { getPartnerDashboard } from '@/lib/partner-service'
import { getClientReferralDashboard } from '@/lib/referral-service'
import {
  buildQrServerImageUrl,
  DEFAULT_REFERRAL_QR_SIZE,
  isAllowedReferralQrPayload,
  referralCodeFromQrPayload,
  referralQrDownloadFilename,
} from '@/lib/referral-qr'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function sessionMayUseReferralPayload(data: string): Promise<boolean> {
  if (!isAllowedReferralQrPayload(data)) return false
  const code = referralCodeFromQrPayload(data)
  if (!code) return false

  const session = await getServerSession(authOptions)
  if (!session?.user) return false

  if (resolveCreditFundingStaffAccess(session).ok) {
    return true
  }

  if (session.user.role === 'partner' && session.user.id) {
    const dashboard = await getPartnerDashboard(session.user.id)
    if ('error' in dashboard) return false
    return dashboard.profile.code.toUpperCase() === code
  }

  if (session.user.role === 'client') {
    const clientSession = await requireClientSession()
    if (clientSession instanceof NextResponse) return false
    const clientId = getClientIdFromSession(clientSession)
    const dashboard = await getClientReferralDashboard(clientId)
    if ('error' in dashboard) return false
    return dashboard.profile.code.toUpperCase() === code
  }

  return false
}

export async function GET(req: NextRequest) {
  try {
    const data = req.nextUrl.searchParams.get('data')?.trim() || ''
    if (!data || data.length > 2048) {
      return NextResponse.json({ error: 'Invalid QR data' }, { status: 400 })
    }
    if (!(await sessionMayUseReferralPayload(data))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sizeRaw = req.nextUrl.searchParams.get('size')
    const size = sizeRaw ? Number.parseInt(sizeRaw, 10) : DEFAULT_REFERRAL_QR_SIZE
    const dimension = Number.isFinite(size) && size >= 120 && size <= 1000 ? size : DEFAULT_REFERRAL_QR_SIZE

    const upstream = buildQrServerImageUrl(data, dimension)
    const imageRes = await fetch(upstream, { next: { revalidate: 86400 } })
    if (!imageRes.ok) {
      return NextResponse.json({ error: 'Could not generate QR code' }, { status: 502 })
    }
    const bytes = await imageRes.arrayBuffer()
    const download = req.nextUrl.searchParams.get('download') === '1'
    const code = referralCodeFromQrPayload(data) || 'referral'
    const filename = referralQrDownloadFilename('referral', code)

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': imageRes.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'private, max-age=3600',
        ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {}),
      },
    })
  } catch (error) {
    logApiRouteError(req, 'referral-qr', error)
    return NextResponse.json({ error: 'Could not generate QR code' }, { status: 500 })
  }
}
