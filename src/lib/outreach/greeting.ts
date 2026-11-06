import { usableFirstName } from './facts'
import {
  hasProspectEmail,
  htmlHasLeakedProspectEmail,
  prospectCopyLooksInternal,
} from './observation'

const NAMED_GREETING = /\b(Hi|Hello)\s+([A-Za-z][A-Za-z'.-]*)\s*,/
const BARE_GREETING = /\b(Hi|Hello),/

export function prospectGreetingIsUsable(html: string, firstName?: string | null): boolean {
  const named = html.match(NAMED_GREETING)
  if (named && !usableFirstName(named[2])) return false
  const name = usableFirstName(firstName)
  if (name) return Boolean(named && usableFirstName(named[2]))
  return BARE_GREETING.test(html) && !named
}

export function prospectObservationIsSafe(text?: string | null): boolean {
  const value = (text || '').trim()
  if (!value) return true
  return !hasProspectEmail(value) && !prospectCopyLooksInternal(value)
}

export function outboundCopyHoldReason(input: {
  html: string
  text?: string | null
  firstName?: string | null
  observation?: string | null
}): string | null {
  if (!prospectGreetingIsUsable(input.html, input.firstName)) return 'unusable_greeting'
  const leaked =
    htmlHasLeakedProspectEmail(input.html) ||
    htmlHasLeakedProspectEmail(input.text) ||
    hasProspectEmail(input.observation)
  if (leaked) return 'observation_contains_email'
  if (prospectCopyLooksInternal(input.observation) || prospectCopyLooksInternal(input.text)) {
    return 'observation_internal_notes'
  }
  return null
}
