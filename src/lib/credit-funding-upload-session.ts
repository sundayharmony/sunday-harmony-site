import crypto from 'crypto'

const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000

function getUploadSessionSecret(): string {
  const key = process.env.CREDIT_FUNDING_ENCRYPTION_KEY?.trim()
  if (key) return key

  const auth = process.env.NEXTAUTH_SECRET?.trim()
  if (auth) return auth

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Upload session signing requires CREDIT_FUNDING_ENCRYPTION_KEY or NEXTAUTH_SECRET')
  }
  return 'dev-credit-funding-upload-session'
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getUploadSessionSecret()).update(payload).digest('base64url')
}

function encodePayload(sessionId: string, exp: number): string {
  return Buffer.from(JSON.stringify({ sessionId, exp }), 'utf8').toString('base64url')
}

function decodePayload(payload: string): { sessionId: string; exp: number } | null {
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sessionId?: string
      exp?: number
    }
    if (!parsed.sessionId || typeof parsed.exp !== 'number') return null
    return { sessionId: parsed.sessionId, exp: parsed.exp }
  } catch {
    return null
  }
}

export function createUploadSession(): { sessionId: string; uploadToken: string } {
  const sessionId = crypto.randomUUID()
  const exp = Date.now() + UPLOAD_SESSION_TTL_MS
  const payload = encodePayload(sessionId, exp)
  return { sessionId, uploadToken: `${payload}.${signPayload(payload)}` }
}

/** @deprecated Legacy signing for in-flight sessions created before TTL tokens. */
export function signUploadSession(sessionId: string): string {
  return signPayload(sessionId)
}

export function verifyUploadSession(sessionId: string, token: string): boolean {
  if (!sessionId || !token) return false

  const dot = token.indexOf('.')
  if (dot > 0) {
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = signPayload(payload)
    if (expected.length !== sig.length) return false
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false
    const decoded = decodePayload(payload)
    if (!decoded || decoded.sessionId !== sessionId) return false
    if (Date.now() > decoded.exp) return false
    return true
  }

  const expectedLegacy = signUploadSession(sessionId)
  if (expectedLegacy.length !== token.length) return false
  return crypto.timingSafeEqual(Buffer.from(expectedLegacy), Buffer.from(token))
}
