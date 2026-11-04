import { revealApplicationSensitiveFieldResult } from '@/lib/credit-funding-admin'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { getDisputeSessionById } from '@/lib/dispute-letters/db'
import { formatSsnFull, normalizeSsnDigits } from '@/lib/ssn-utils'

export type LetterConsumerIdentity = {
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

/**
 * Load full SSN + DOB from the credit-funding application linked to a dispute session.
 * Server-only — never send these values from the browser.
 */
export async function loadLetterConsumerIdentity(
  sessionId: string
): Promise<LetterConsumerIdentity> {
  const session = await getDisputeSessionById(sessionId)
  const applicationUuid = session?.application_uuid?.trim()
  if (!applicationUuid) {
    return { ssn: null, dob: null }
  }

  const app = await getCreditFundingApplicationById(applicationUuid)
  if (!app) {
    return { ssn: null, dob: null }
  }

  const ssnResult = revealApplicationSensitiveFieldResult(app, 'ssn')
  const dobResult = revealApplicationSensitiveFieldResult(app, 'date_of_birth')

  const ssn = ssnResult.ok ? formatSsnForLetter(ssnResult.value) : null
  const dob = dobResult.ok ? formatDobForLetter(dobResult.value) : null

  return {
    ssn: ssn || null,
    dob: dob || null,
  }
}
