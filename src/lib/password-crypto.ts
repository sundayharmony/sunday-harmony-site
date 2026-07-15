import crypto from 'crypto'

const FORMAT = 'pbkdf2'
const DIGEST = 'sha512'
const KEY_LENGTH = 64
const SALT_BYTES = 16
const LEGACY_ITERATIONS = 10_000
const CURRENT_ITERATIONS = 210_000
const MAX_ACCEPTED_ITERATIONS = 1_000_000

type ParsedPasswordHash = {
  hash: Buffer
  iterations: number
  legacy: boolean
  salt: string
}

function isHex(value: string, bytes: number): boolean {
  return value.length === bytes * 2 && /^[0-9a-f]+$/i.test(value)
}

function parsePasswordHash(stored: string): ParsedPasswordHash | null {
  if (typeof stored !== 'string' || !stored) return null

  const legacyParts = stored.split(':')
  if (legacyParts.length === 2) {
    const [salt, hash] = legacyParts
    if (!isHex(salt, SALT_BYTES) || !isHex(hash, KEY_LENGTH)) return null
    return {
      hash: Buffer.from(hash, 'hex'),
      iterations: LEGACY_ITERATIONS,
      legacy: true,
      salt,
    }
  }

  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== FORMAT) return null

  const iterations = Number(parts[1])
  const salt = parts[2]
  const hash = parts[3]
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < LEGACY_ITERATIONS ||
    iterations > MAX_ACCEPTED_ITERATIONS ||
    !isHex(salt, SALT_BYTES) ||
    !isHex(hash, KEY_LENGTH)
  ) {
    return null
  }

  return {
    hash: Buffer.from(hash, 'hex'),
    iterations,
    legacy: false,
    salt,
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex')
  const hash = crypto
    .pbkdf2Sync(password, salt, CURRENT_ITERATIONS, KEY_LENGTH, DIGEST)
    .toString('hex')
  return `${FORMAT}$${CURRENT_ITERATIONS}$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parsePasswordHash(stored)
  if (!parsed) return false

  try {
    const candidate = crypto.pbkdf2Sync(
      password,
      parsed.salt,
      parsed.iterations,
      KEY_LENGTH,
      DIGEST
    )
    return (
      candidate.length === parsed.hash.length &&
      crypto.timingSafeEqual(candidate, parsed.hash)
    )
  } catch {
    return false
  }
}

export function passwordNeedsRehash(stored: string): boolean {
  const parsed = parsePasswordHash(stored)
  return !parsed || parsed.legacy || parsed.iterations < CURRENT_ITERATIONS
}
