/** Normalized crop rect in image space (0–1 fractions of natural width/height). */
export type LetterCropRect = { x: number; y: number; w: number; h: number }

export const LETTER_CROP_MIN = 0.05

export function clampLetterCrop(next: LetterCropRect, min = LETTER_CROP_MIN): LetterCropRect {
  const x = Math.min(Math.max(next.x, 0), 1 - min)
  const y = Math.min(Math.max(next.y, 0), 1 - min)
  const w = Math.min(Math.max(next.w, min), 1 - x)
  const h = Math.min(Math.max(next.h, min), 1 - y)
  return { x, y, w, h }
}

export function initialLetterCrop(): LetterCropRect {
  return { x: 0.08, y: 0.08, w: 0.84, h: 0.84 }
}

/** Apply a pointer drag (dx/dy as fractions of displayed image size) for freeform move/resize. */
export function applyLetterCropPointer(
  start: LetterCropRect,
  kind: string,
  dx: number,
  dy: number,
  min = LETTER_CROP_MIN
): LetterCropRect {
  let next = { ...start }
  if (kind === 'move') {
    next = { ...start, x: start.x + dx, y: start.y + dy }
    // Keep size; clamp position so the box stays inside the image.
    next.x = Math.min(Math.max(next.x, 0), 1 - next.w)
    next.y = Math.min(Math.max(next.y, 0), 1 - next.h)
    return next
  }

  if (kind.includes('w')) {
    const nx = start.x + dx
    const nw = start.w - dx
    if (nw >= min) {
      next.x = nx
      next.w = nw
    }
  }
  if (kind.includes('e')) {
    next.w = start.w + dx
  }
  if (kind.includes('n')) {
    const ny = start.y + dy
    const nh = start.h - dy
    if (nh >= min) {
      next.y = ny
      next.h = nh
    }
  }
  if (kind.includes('s')) {
    next.h = start.h + dy
  }
  return clampLetterCrop(next, min)
}

export function letterCropToNaturalPixels(
  crop: LetterCropRect,
  naturalW: number,
  naturalH: number
): { sx: number; sy: number; sw: number; sh: number } {
  const sx = Math.round(crop.x * naturalW)
  const sy = Math.round(crop.y * naturalH)
  const sw = Math.max(1, Math.round(crop.w * naturalW))
  const sh = Math.max(1, Math.round(crop.h * naturalH))
  const maxW = Math.max(1, naturalW - sx)
  const maxH = Math.max(1, naturalH - sy)
  return { sx, sy, sw: Math.min(sw, maxW), sh: Math.min(sh, maxH) }
}

export function isLetterCropValid(crop: LetterCropRect, min = LETTER_CROP_MIN): boolean {
  return (
    crop.w >= min &&
    crop.h >= min &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.x + crop.w <= 1.0001 &&
    crop.y + crop.h <= 1.0001
  )
}

/** Same-origin authorized content URL for crop canvas (no arbitrary host). */
export function letterIdentityDocumentContentUrl(documentId: string, applicationId: string): string {
  const id = encodeURIComponent(documentId)
  const app = encodeURIComponent(applicationId)
  return `/api/admin/credit-funding/documents/${id}/content?applicationId=${app}`
}
