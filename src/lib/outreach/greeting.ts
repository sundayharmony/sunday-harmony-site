import { usableFirstName } from './facts'

const NAMED_GREETING = /Hi\s+([A-Za-z][A-Za-z'.-]*)\s*,/
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

export function prospectGreetingIsUsable(html: string, firstName?: string | null): boolean {
  if (!usableFirstName(firstName)) return false
  const named = html.match(NAMED_GREETING)
  if (!named) return false
  return Boolean(usableFirstName(named[1]))
}

export function prospectObservationIsSafe(text?: string | null): boolean {
  const value = (text || '').trim()
  if (!value) return true
  return !EMAIL_IN_TEXT.test(value)
}
