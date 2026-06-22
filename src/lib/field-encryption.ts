import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const raw = process.env.CREDIT_FUNDING_ENCRYPTION_KEY?.trim()
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CREDIT_FUNDING_ENCRYPTION_KEY is required in production')
    }
    // Dev-only fallback — never use in production.
    return crypto.createHash('sha256').update('dev-credit-funding-key').digest()
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('CREDIT_FUNDING_ENCRYPTION_KEY must be 32 bytes (base64-encoded)')
  }
  return key
}

/** Encrypt sensitive text at rest. Returns base64(iv + tag + ciphertext). */
export function encryptField(plaintext: string): string {
  if (!plaintext) return ''
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/** Decrypt sensitive text. Returns empty string on failure. */
export function decryptField(ciphertext: string): string {
  if (!ciphertext) return ''
  try {
    const key = getEncryptionKey()
    const data = Buffer.from(ciphertext, 'base64')
    if (data.length < IV_LENGTH + TAG_LENGTH + 1) return ''
    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}

/** Mask sensitive values for admin list views. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return `***-***-${digits.slice(-4)}`
}

export function maskSecret(value: string): string {
  if (!value) return '—'
  return '••••••••'
}
