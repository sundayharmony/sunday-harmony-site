import { revealApplicationSensitiveFieldResult } from '@/lib/credit-funding-admin'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { decryptApplicationOperationalFields } from '@/lib/credit-funding-sensitive-fields'
import { getDisputeSessionById } from '@/lib/dispute-letters/db'
import { isEncryptedField } from '@/lib/field-encryption'
import { formatSsnFull, normalizeSsnDigits } from '@/lib/ssn-utils'

export type LetterConsumerIdentity = {
  name: string | null
  addresses: string[]
  ssn: string | null
  dob: string | null
}

/** Format intake DOB (YYYY-MM-DD or similar) for mailed letter copy. */
export function formatDobForLetter(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!iso) return value
  const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** Format full SSN as XXX-XX-XXXX for letter bodies. */
export function formatSsnForLetter(raw: string): string {
  const digits = normalizeSsnDigits(raw)
  if (digits.length === 9) return formatSsnFull(digits)
  return raw.trim()
}

function cleanAddressPart(value: unknown): string {
  const text = String(value || '').trim()
  // Never surface ciphertext in letter identity fields.
  if (!text || isEncryptedField(text) || text.startsWith('enc:v1:')) return ''
  return text
}

/** Build one mailing line from intake address fields (already decrypted). */
export function formatAddressForLetter(app: {
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
}): string {
  const street = cleanAddressPart(app.address)
  const region = [cleanAddressPart(app.city), cleanAddressPart(app.state)].filter(Boolean).join(', ')
  const cityLine = [region, cleanAddressPart(app.zip_code)].filter(Boolean).join(' ')
  return [street, cityLine].filter(Boolean).join(', ')
}

/**
 * Load consumer identity for letters from the credit-funding application linked
 * to a dispute session. Server-only for SSN/DOB — never send those from the browser.
 */
export async function loadLetterConsumerIdentity(
  sessionId: string
): Promise<LetterConsumerIdentity> {
  const empty: LetterConsumerIdentity = {
    name: null,
    addresses: [],
    ssn: null,
    dob: null,
  }
  const session = await getDisputeSessionById(sessionId)
  const applicationUuid = session?.application_uuid?.trim()
  if (!applicationUuid) {
    return empty
  }

  const app = await getCreditFundingApplicationById(applicationUuid)
  if (!app) {
    return empty
  }

  const ssnResult = revealApplicationSensitiveFieldResult(app, 'ssn')
  const dobResult = revealApplicationSensitiveFieldResult(app, 'date_of_birth')

  const ssn = ssnResult.ok ? formatSsnForLetter(ssnResult.value) : null
  const dob = dobResult.ok ? formatDobForLetter(dobResult.value) : null
  const name = String(app.full_name || '').trim() || null
  // Address/city/state/zip are stored encrypted on the application row.
  const decrypted = decryptApplicationOperationalFields(app)
  const address = formatAddressForLetter(decrypted)

  return {
    name,
    addresses: address ? [address] : [],
    ssn: ssn || null,
    dob: dob || null,
  }
}

/** Prefer staff Confirm-step overrides; fall back to intake application identity. */
export function resolveLetterConsumerFields(
  body: {
    consumer_name?: string | null
    consumer_addresses?: string[] | null
  },
  identity: LetterConsumerIdentity
): {
  consumer_name: string | null
  consumer_addresses: string[] | null
  consumer_ssn: string | null
  consumer_dob: string | null
} {
  const bodyName = typeof body.consumer_name === 'string' ? body.consumer_name.trim() : ''
  const bodyAddresses = Array.isArray(body.consumer_addresses)
    ? body.consumer_addresses
        .map((line) => String(line || '').trim())
        .filter((line) => line && !isEncryptedField(line) && !line.startsWith('enc:v1:'))
    : []
  return {
    consumer_name: bodyName || identity.name,
    consumer_addresses: bodyAddresses.length
      ? bodyAddresses
      : identity.addresses.length
        ? identity.addresses
        : null,
    consumer_ssn: identity.ssn,
    consumer_dob: identity.dob,
  }
}
