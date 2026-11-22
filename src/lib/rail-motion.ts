/** Horizontal travel for the package rail. Transform only — no width changes. */
export function railTravel(trackWidth: number, viewWidth: number): number {
  if (!Number.isFinite(trackWidth) || !Number.isFinite(viewWidth)) return 0
  return Math.max(0, trackWidth - viewWidth)
}

/** Progress 0–1 maps to a negative translateX. */
export function railOffset(progress: number, travel: number): number {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const distance = Number.isFinite(travel) ? Math.max(0, travel) : 0
  if (p === 0 || distance === 0) return 0
  return -p * distance
}
