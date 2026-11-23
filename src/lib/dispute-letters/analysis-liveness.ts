/**
 * The API touches the session every minute while it reads (OCR of screenshots can take
 * several minutes on Render). No update for this long means the worker died.
 */
export const STALE_ANALYSIS_MS = 5 * 60 * 1000

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
