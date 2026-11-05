import { enqueueLeadSnapshots, leadRowToSnapshot } from './enqueue'
import { resolveOutreachStore } from './runtime'

/** Best-effort enqueue after website lead import. Never sends. Failures must not fail the import. */
export async function enqueueImportedLeadsBestEffort(rows: Array<Record<string, unknown>>): Promise<void> {
  try {
    const snapshots = rows.map(leadRowToSnapshot).filter((row): row is NonNullable<typeof row> => Boolean(row))
    if (snapshots.length === 0) return
    const store = resolveOutreachStore()
    await enqueueLeadSnapshots(store, snapshots, { actor: 'leads-import' })
  } catch {
    /* Outreach tables may be unapplied. Import still succeeds. */
  }
}
