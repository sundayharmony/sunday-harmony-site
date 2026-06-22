import crypto from 'crypto'

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

export function createUploadSession(): { sessionId: string; uploadToken: string } {
  const sessionId = crypto.randomUUID()
  return { sessionId, uploadToken: signUploadSession(sessionId) }
}

export function signUploadSession(sessionId: string): string {
  return crypto.createHmac('sha256', getUploadSessionSecret()).update(sessionId).digest('base64url')
}

export function verifyUploadSession(sessionId: string, token: string): boolean {
  if (!sessionId || !token) return false
  const expected = signUploadSession(sessionId)
  if (expected.length !== token.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
}
