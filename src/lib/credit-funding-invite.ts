import {
  getCreditFundingSigningSecret,
  signCreditFundingPayload,
  verifyCreditFundingSignature,
} from '@/lib/credit-funding-signing'

export const APPLICATION_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000

function getInviteSecret(): string {
  return getCreditFundingSigningSecret('Application invite signing')
}

export function createApplicationInviteToken(applicationId: string, expiresAtMs: number): string {
  const payload = `${applicationId}.${expiresAtMs}`
  const sig = signCreditFundingPayload(getInviteSecret(), payload)
  return `${payload}.${sig}`
}

export function verifyApplicationInviteToken(token: string): { applicationId: string; expiresAtMs: number } | null {
  if (!token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [applicationId, expiresAtStr, sig] = parts
  if (!applicationId || !expiresAtStr || !sig) return null

  const expiresAtMs = Number(expiresAtStr)
  if (!Number.isFinite(expiresAtMs)) return null

  const payload = `${applicationId}.${expiresAtMs}`
  if (!verifyCreditFundingSignature(getInviteSecret(), payload, sig)) return null

  return { applicationId, expiresAtMs }
}

export function inviteTokenMatchesStoredExpiry(
  verified: { expiresAtMs: number },
  storedExpiresAt?: string | null
): boolean {
  if (!storedExpiresAt) return true
  const storedMs = new Date(storedExpiresAt).getTime()
  return Number.isFinite(storedMs) && Math.abs(storedMs - verified.expiresAtMs) <= 1000
}

export function maskInviteEmail(email: string): string {
  const [local, domain] = email.trim().split('@')
  if (!local || !domain) return ''
  const first = local.slice(0, 1)
  const last = local.length > 2 ? local.slice(-1) : ''
  return `${first}${'*'.repeat(Math.max(local.length - 2, 2))}${last}@${domain}`
}

export function firstNameFromInviteName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || ''
}

export function buildApplicationInviteUrl(applicationId: string, expiresAtMs: number): string {
  const site = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sundayharmony.com').replace(/\/$/, '')
  const token = createApplicationInviteToken(applicationId, expiresAtMs)
  return `${site}/credit-funding?invite=${encodeURIComponent(token)}`
}
