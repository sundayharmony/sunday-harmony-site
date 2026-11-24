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

/** Size of the canvas that holds an image rotated by `deg` (clockwise). */
export function rotatedSize(w: number, h: number, deg: number): { w: number; h: number } {
  const rad = (deg * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  return { w: Math.max(1, Math.round(w * c + h * s)), h: Math.max(1, Math.round(w * s + h * c)) }
}

/** Keep an angle in [0, 360). */
export function normalizeAngle(deg: number): number {
  const a = deg % 360
  return a < 0 ? a + 360 : a
}

/**
 * Draw `source` rotated clockwise by `deg` onto a new canvas sized to hold all of it,
 * scaled so its longest side is at most `maxSide`. Corners are filled white (letters print on white).
 */
export function drawRotated(
  source: CanvasImageSource & { width: number; height: number },
  deg: number,
  maxSide = Infinity
): HTMLCanvasElement {
  const full = rotatedSize(source.width, source.height, deg)
  const scale = Math.min(1, maxSide / Math.max(full.w, full.h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(full.w * scale))
  canvas.height = Math.max(1, Math.round(full.h * scale))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.scale(scale, scale)
  ctx.drawImage(source, -source.width / 2, -source.height / 2, source.width, source.height)
  return canvas
}

type Pixels = { data: Uint8ClampedArray | number[]; width: number; height: number }

/**
 * Find an ID card lying on a plainer background: pixels that differ from the border colour
 * form the card; their principal axis gives the tilt and their spread the crop.
 * Returns the clockwise angle that makes the card level, and the crop in the rotated image.
 * Null when no clear card stands out (busy background, card fills the photo).
 */
export function detectLetterCard(px: Pixels): { angle: number; crop: LetterCropRect } | null {
  const { data, width: w, height: h } = px
  const at = (x: number, y: number) => (y * w + x) * 4
  const border: number[][] = []
  for (let x = 0; x < w; x += 2) border.push([x, 0], [x, h - 1])
  for (let y = 0; y < h; y += 2) border.push([0, y], [w - 1, y])
  const median = [0, 1, 2].map((c) => {
    const vals = border.map(([x, y]) => data[at(x, y) + c]).sort((a, b) => a - b)
    return vals[vals.length >> 1]
  })
  const pts: [number, number][] = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = at(x, y)
      const d = Math.abs(data[i] - median[0]) + Math.abs(data[i + 1] - median[1]) + Math.abs(data[i + 2] - median[2])
      if (d > 60) pts.push([x, y])
    }
  }
  const share = pts.length / (w * h)
  if (share < 0.04 || share > 0.92) return null

  let mx = 0
  let my = 0
  for (const [x, y] of pts) {
    mx += x
    my += y
  }
  mx /= pts.length
  my /= pts.length
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
    sxy += (x - mx) * (y - my)
  }
  // Principal axis angle (y down), folded to (-45, 45] so small tilts are undone and an
  // upright portrait card is not turned on its side.
  let theta = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI
  if (theta > 45) theta -= 90
  if (theta <= -45) theta += 90
  const angle = Math.abs(theta) < 0.5 ? 0 : -theta

  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const out = rotatedSize(w, h, angle)
  const xs: number[] = []
  const ys: number[] = []
  for (const [x, y] of pts) {
    const dx = x - w / 2
    const dy = y - h / 2
    xs.push(dx * cos - dy * sin + out.w / 2)
    ys.push(dx * sin + dy * cos + out.h / 2)
  }
  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)
  const pick = (vals: number[], q: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.round(q * (vals.length - 1))))]
  const pad = 0.01
  const x0 = pick(xs, 0.005) / out.w - pad
  const x1 = pick(xs, 0.995) / out.w + pad
  const y0 = pick(ys, 0.005) / out.h - pad
  const y1 = pick(ys, 0.995) / out.h + pad
  const crop = clampLetterCrop({ x: Math.max(0, x0), y: Math.max(0, y0), w: x1 - Math.max(0, x0), h: y1 - Math.max(0, y0) })
  if (crop.w > 0.97 && crop.h > 0.97) return null
  return { angle: normalizeAngle(angle), crop }
}
