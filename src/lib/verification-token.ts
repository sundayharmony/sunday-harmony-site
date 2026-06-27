import crypto from 'crypto'

function tokenPepper(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET is required to hash verification tokens')
  }
  return secret || 'dev-verification-token-pepper'
}

/** Store hashed one-time codes (password reset, portal setup) instead of plaintext. */
export function hashVerificationToken(plain: string): string {
  const normalized = plain.trim().replace(/\s/g, '')
  const h = crypto.createHmac('sha256', tokenPepper()).update(normalized).digest('hex')
  return `hmac:${h}`
}

export function verificationTokenMatches(
  stored: string | null | undefined,
  plain: string
): boolean {
  if (!stored || !plain) return false
  const normalized = plain.trim().replace(/\s/g, '')

  if (stored.startsWith('hmac:')) {
    const expected = hashVerificationToken(normalized)
    if (stored.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(expected))
  }

  // Legacy plaintext row — constant-time compare, re-hash on successful use
  if (stored.length !== normalized.length) return false
  return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(normalized))
}

export function isHashedVerificationToken(stored: string | null | undefined): boolean {
  return Boolean(stored?.startsWith('hmac:'))
}
