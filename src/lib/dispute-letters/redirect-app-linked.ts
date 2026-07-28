import { redirect } from 'next/navigation'
import { getDisputeSessionById } from '@/lib/dispute-letters/db'
import {
  creditFundingLettersHref,
  type DisputeLetterStep,
} from '@/lib/dispute-letters/workflow'

/** If this session belongs to a funding application, send staff into Credit Intelligence. */
export async function redirectAppLinkedDisputeSession(
  sessionId: string,
  step: DisputeLetterStep
): Promise<void> {
  const session = await getDisputeSessionById(sessionId)
  if (session?.application_uuid) {
    redirect(creditFundingLettersHref(session.application_uuid, sessionId, step))
  }
}
