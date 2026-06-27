import crypto from 'crypto'
import {
  decodeSignedJsonPayload,
  encodeSignedJsonPayload,
  getCreditFundingSigningSecret,
  signCreditFundingPayload,
  verifyCreditFundingSignature,
} from '@/lib/credit-funding-signing'

const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000

function getUploadSessionSecret(): string {
  return getCreditFundingSigningSecret('Upload session signing')
}

function signPayload(payload: string): string {
  return signCreditFundingPayload(getUploadSessionSecret(), payload)
}

function encodePayload(sessionId: string, exp: number): string {
  return encodeSignedJsonPayload({ sessionId, exp })
}

function decodePayload(payload: string): { sessionId: string; exp: number } | null {
  const parsed = decodeSignedJsonPayload<{ sessionId?: string; exp?: number }>(payload)
  if (!parsed?.sessionId || typeof parsed.exp !== 'number') return null
  return { sessionId: parsed.sessionId, exp: parsed.exp }
}

export function createUploadSession(): { sessionId: string; uploadToken: string } {
  const sessionId = crypto.randomUUID()
  const exp = Date.now() + UPLOAD_SESSION_TTL_MS
  const payload = encodePayload(sessionId, exp)
  return { sessionId, uploadToken: `${payload}.${signPayload(payload)}` }
}

export function verifyUploadSession(sessionId: string, token: string): boolean {
  if (!sessionId || !token) return false

  const dot = token.indexOf('.')
  if (dot <= 0) return false

  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!verifyCreditFundingSignature(getUploadSessionSecret(), payload, sig)) return false

  const decoded = decodePayload(payload)
  if (!decoded || decoded.sessionId !== sessionId) return false
  if (Date.now() > decoded.exp) return false
  return true
}
