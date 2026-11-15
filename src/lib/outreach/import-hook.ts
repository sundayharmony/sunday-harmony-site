import { leadIsReadyQueueCandidate } from './eligibility'
import { enqueueLeadSnapshots, leadRowToSnapshot } from './enqueue'
import { resolveOutreachStore } from './runtime'

/**
 * Draft letters for these lead rows. Never sends.
 * Failures must not fail the save or import that called this.
 */
export async function enqueueImportedLeadsBestEffort(
  rows: Array<Record<string, unknown>>,
  actor = 'leads-import'
): Promise<void> {
  try {
    if (rows.length === 0) return
    const leads = rows
      .map((row) => leadRowToSnapshot(row))
      .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead && leadIsReadyQueueCandidate(lead)))
    if (leads.length === 0) return
    const store = resolveOutreachStore()
    const result = await enqueueLeadSnapshots(store, leads, { actor })
    if (result.enqueued > 0 || result.ineligible > 0 || result.blockedReview > 0) {
      console.log(
        'outreach drafted new leads',
        JSON.stringify({
          actor,
          submitted: rows.length,
          eligible: leads.length,
          enqueued: result.enqueued,
          ineligible: result.ineligible,
          blocked: result.blockedReview,
          skipped: result.skipped,
        })
      )
    }
  } catch {
    /* Outreach tables may be unapplied. The lead save still succeeds. */
  }
}
