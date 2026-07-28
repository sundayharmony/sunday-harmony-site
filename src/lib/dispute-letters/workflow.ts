export type DisputeLetterStep = 'health' | 'review' | 'confirm' | 'letters'

export const DISPUTE_LETTER_STEPS: { slug: DisputeLetterStep; label: string }[] = [
  { slug: 'health', label: 'Health' },
  { slug: 'review', label: 'Disputes' },
  { slug: 'confirm', label: 'Confirm' },
  { slug: 'letters', label: 'Letters' },
]

export function parseDisputeLetterStep(value: string | null | undefined): DisputeLetterStep | null {
  if (value === 'health' || value === 'review' || value === 'confirm' || value === 'letters') {
    return value
  }
  return null
}

export function creditFundingLettersHref(
  applicationId: string,
  sessionId: string,
  step: DisputeLetterStep
): string {
  const params = new URLSearchParams({
    id: applicationId,
    tab: 'intelligence',
    letters: step,
    session: sessionId,
  })
  return `/admin/credit-funding?${params.toString()}`
}

export function disputeLettersStandaloneHref(sessionId: string, step: DisputeLetterStep): string {
  return `/admin/dispute-letters/${sessionId}/${step}`
}
