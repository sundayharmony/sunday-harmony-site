import crypto from 'crypto'

export function getCreditFundingSigningSecret(purpose: string): string {
  const signing = process.env.CREDIT_FUNDING_SIGNING_SECRET?.trim()
  if (signing) return signing

  const key = process.env.CREDIT_FUNDING_ENCRYPTION_KEY?.trim()
  if (key) return key

  const auth = process.env.NEXTAUTH_SECRET?.trim()
  if (auth) return auth

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${purpose} requires CREDIT_FUNDING_SIGNING_SECRET, CREDIT_FUNDING_ENCRYPTION_KEY, or NEXTAUTH_SECRET`)
  }
  return `dev-credit-funding-${purpose}`
}

export function signCreditFundingPayload(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

export function verifyCreditFundingSignature(secret: string, payload: string, sig: string): boolean {
  const expected = signCreditFundingPayload(secret, payload)
  if (expected.length !== sig.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
}

export function encodeSignedJsonPayload(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')
}

export function decodeSignedJsonPayload<T extends Record<string, unknown>>(payload: string): T | null {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}
