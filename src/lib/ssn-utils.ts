/** Strip non-digits and cap at 9 characters. */
export function normalizeSsnDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 9)
}

/** Format as XXX-XX-XXXX while the user is entering digits. */
export function formatSsnWhileTyping(digits: string): string {
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

/** Mask all but the last four digits for display after entry. */
export function maskSsnLast4(digits: string): string {
  if (digits.length !== 9) return formatSsnWhileTyping(digits)
  return `•••-••-${digits.slice(5)}`
}

/** Full SSN for admin views (XXX-XX-XXXX). */
export function formatSsnFull(digits: string): string {
  if (digits.length !== 9) return digits
  return formatSsnWhileTyping(digits)
}

export function isValidSsn(digits: string): boolean {
  if (digits.length !== 9) return false
  if (digits === '000000000') return false
  if (digits.slice(0, 3) === '000' || digits.slice(0, 3) === '666') return false
  if (digits.slice(3, 5) === '00') return false
  if (digits.slice(5) === '0000') return false
  const area = Number.parseInt(digits.slice(0, 3), 10)
  if (area >= 900) return false
  return true
}
