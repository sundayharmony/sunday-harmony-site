import crypto from 'crypto'
import {
  decodeSignedJsonPayload,
  encodeSignedJsonPayload,
  getCreditFundingSigningSecret,
  signCreditFundingPayload,
  verifyCreditFundingSignature,
} from '@/lib/credit-funding-signing'
import {
  CREDIT_FUNDING_MAX_BYTES,
  isDocumentType,
  type DocumentType,
} from '@/lib/credit-funding-types'

const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000
const STAGED_FILE_TOKEN_KIND = 'credit-funding-staged-file'

export type TrustedStagedFileMetadata = {
  documentType: DocumentType
  storagePath: string
  file_name: string
  file_size: number
  file_type: string
  mime_type: string
  scan_status: 'clean'
}

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

export function createStagedFileMetadataToken(
  sessionId: string,
  metadata: TrustedStagedFileMetadata
): string {
  const payload = encodeSignedJsonPayload({
    kind: STAGED_FILE_TOKEN_KIND,
    sessionId,
    ...metadata,
    exp: Date.now() + UPLOAD_SESSION_TTL_MS,
  })
  return `${payload}.${signPayload(payload)}`
}

export function verifyStagedFileMetadataToken(
  sessionId: string,
  token: string
): TrustedStagedFileMetadata | null {
  if (!sessionId || !token) return null

  const dot = token.indexOf('.')
  if (dot <= 0) return null

  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!verifyCreditFundingSignature(getUploadSessionSecret(), payload, signature)) return null

  const decoded = decodeSignedJsonPayload<{
    kind?: string
    sessionId?: string
    documentType?: unknown
    storagePath?: unknown
    file_name?: unknown
    file_size?: unknown
    file_type?: unknown
    mime_type?: unknown
    scan_status?: unknown
    exp?: number
  }>(payload)
  if (
    !decoded ||
    decoded.kind !== STAGED_FILE_TOKEN_KIND ||
    decoded.sessionId !== sessionId ||
    typeof decoded.exp !== 'number' ||
    Date.now() > decoded.exp ||
    !isDocumentType(decoded.documentType) ||
    typeof decoded.storagePath !== 'string' ||
    !decoded.storagePath.startsWith(
      `staging/${sessionId}/${decoded.documentType}/`
    ) ||
    typeof decoded.file_name !== 'string' ||
    !decoded.file_name ||
    decoded.file_name.length > 300 ||
    typeof decoded.file_size !== 'number' ||
    !Number.isSafeInteger(decoded.file_size) ||
    decoded.file_size <= 0 ||
    decoded.file_size > CREDIT_FUNDING_MAX_BYTES ||
    typeof decoded.file_type !== 'string' ||
    !decoded.file_type ||
    decoded.file_type.length > 16 ||
    typeof decoded.mime_type !== 'string' ||
    !decoded.mime_type ||
    decoded.mime_type.length > 100 ||
    decoded.scan_status !== 'clean'
  ) {
    return null
  }

  return {
    documentType: decoded.documentType,
    storagePath: decoded.storagePath,
    file_name: decoded.file_name,
    file_size: decoded.file_size,
    file_type: decoded.file_type,
    mime_type: decoded.mime_type,
    scan_status: 'clean',
  }
}

export function parseTrustedStagedFileSubmission(
  sessionId: string,
  submitted: unknown,
  maxFiles: number
): TrustedStagedFileMetadata[] | null {
  if (!Array.isArray(submitted) || submitted.length > maxFiles) return null

  const trusted = submitted.map((entry) => {
    const token =
      typeof entry === 'object' &&
      entry !== null &&
      'metadataToken' in entry &&
      typeof entry.metadataToken === 'string'
        ? entry.metadataToken
        : ''
    return verifyStagedFileMetadataToken(sessionId, token)
  })

  return trusted.every((entry): entry is TrustedStagedFileMetadata => entry !== null)
    ? trusted
    : null
}
