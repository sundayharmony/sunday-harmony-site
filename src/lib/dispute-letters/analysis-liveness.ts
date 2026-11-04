/** A live local parse finishes well inside this. Older than this means the worker died. */
export const STALE_ANALYSIS_MS = 3 * 60 * 1000

export const STALE_ANALYSIS_MESSAGE =
  'Analysis stopped before it finished. Upload the report again.'

export function isStaleAnalysis(
  status: string | null | undefined,
  updatedAt: string | null | undefined,
  now = Date.now(),
  staleMs = STALE_ANALYSIS_MS
): boolean {
  if (status !== 'analyzing') return false
  const updated = Date.parse(updatedAt || '')
  if (!Number.isFinite(updated)) return false
  return now - updated >= staleMs
}
