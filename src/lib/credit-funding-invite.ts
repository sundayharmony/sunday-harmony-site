import crypto from 'crypto'

export const APPLICATION_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000

function getInviteSecret(): string {
  const key = process.env.CREDIT_FUNDING_ENCRYPTION_KEY?.trim()
  if (key) return key

  const auth = process.env.NEXTAUTH_SECRET?.trim()
  if (auth) return auth

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Application invite signing requires CREDIT_FUNDING_ENCRYPTION_KEY or NEXTAUTH_SECRET')
  }
  return 'dev-credit-funding-invite'
}

export function createApplicationInviteToken(applicationId: string, expiresAtMs: number): string {
  const payload = `${applicationId}.${expiresAtMs}`
  const sig = crypto.createHmac('sha256', getInviteSecret()).update(payload).digest('base64url')
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
  const expected = crypto.createHmac('sha256', getInviteSecret()).update(payload).digest('base64url')
  if (expected.length !== sig.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null

  return { applicationId, expiresAtMs }
}

export function buildApplicationInviteUrl(applicationId: string, expiresAtMs: number): string {
  const site = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sundayharmony.com').replace(/\/$/, '')
  const token = createApplicationInviteToken(applicationId, expiresAtMs)
  return `${site}/credit-funding?invite=${encodeURIComponent(token)}`
}
