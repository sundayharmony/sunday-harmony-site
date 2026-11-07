import { ensureReadyQueue } from './enqueue'
import { resolveOutreachStore } from './runtime'

/** Best-effort top-up of the ready queue after website lead import. Never sends. Failures must not fail the import. */
export async function enqueueImportedLeadsBestEffort(rows: Array<Record<string, unknown>>): Promise<void> {
  try {
    if (rows.length === 0) return
    const store = resolveOutreachStore()
    await ensureReadyQueue(store, { actor: 'leads-import' })
  } catch {
    /* Outreach tables may be unapplied. Import still succeeds. */
  }
}
