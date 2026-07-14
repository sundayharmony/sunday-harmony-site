import crypto from 'crypto'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { decryptField, encryptField } from '@/lib/field-encryption'
import { hashVerificationToken, verificationTokenMatches } from '@/lib/verification-token'

const ISSUER = 'Sunday Harmony'
const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_BYTES = 4

export function isStaffRole(role?: string | null): boolean {
  return role === 'admin' || role === 'credit_manager'
}

export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32
}

export function buildTotp(secretBase32: string, accountName: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountName,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
}

export function verifyTotpCode(secretBase32: string, code: string, accountName = 'user'): boolean {
  const normalized = code.trim().replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) return false
  const totp = buildTotp(secretBase32, accountName)
  const delta = totp.validate({ token: normalized, window: 1 })
  return delta !== null
}

export function encryptTotpSecret(secretBase32: string): string {
  return encryptField(secretBase32)
}

export function decryptTotpSecret(encrypted: string): string {
  return decryptField(encrypted)
}

export async function totpQrDataUrl(secretBase32: string, accountName: string): Promise<string> {
  const totp = buildTotp(secretBase32, accountName)
  return QRCode.toDataURL(totp.toString(), { margin: 1, width: 220 })
}

export function generateBackupCodes(): { plain: string[]; hashes: string[] } {
  const plain: string[] = []
  const hashes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(BACKUP_CODE_BYTES).toString('hex')
    plain.push(code)
    hashes.push(hashVerificationToken(code))
  }
  return { plain, hashes }
}

export function consumeBackupCode(
  hashes: string[] | null | undefined,
  plainCode: string
): { ok: true; remaining: string[] } | { ok: false } {
  if (!hashes?.length || !plainCode?.trim()) return { ok: false }
  const normalized = plainCode.trim().replace(/\s/g, '').toLowerCase()
  const idx = hashes.findIndex((h) => verificationTokenMatches(h, normalized))
  if (idx < 0) return { ok: false }
  const remaining = hashes.filter((_, i) => i !== idx)
  return { ok: true, remaining }
}

export type MfaUserRow = {
  id: string
  email: string
  name: string
  role: string
  totp_enabled?: boolean | null
  totp_secret_encrypted?: string | null
  totp_backup_hashes?: string[] | null
}
