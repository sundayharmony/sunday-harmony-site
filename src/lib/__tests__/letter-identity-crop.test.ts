import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  applyLetterCropPointer,
  clampLetterCrop,
  initialLetterCrop,
  isLetterCropValid,
  letterCropToNaturalPixels,
  letterIdentityDocumentContentUrl,
  LETTER_CROP_MIN,
} from '../letter-identity-crop'

describe('letter identity freeform crop math', () => {
  it('clamps selection inside the image with a minimum size', () => {
    const c = clampLetterCrop({ x: -0.2, y: 0.9, w: 2, h: 0.02 })
    assert.ok(c.x >= 0)
    assert.ok(c.y >= 0)
    assert.ok(c.w >= LETTER_CROP_MIN)
    assert.ok(c.h >= LETTER_CROP_MIN)
    assert.ok(c.x + c.w <= 1.0001)
    assert.ok(c.y + c.h <= 1.0001)
  })

  it('moves without changing size and stays in bounds', () => {
    const start = { x: 0.1, y: 0.1, w: 0.4, h: 0.3 }
    const moved = applyLetterCropPointer(start, 'move', 0.8, 0.8)
    assert.equal(moved.w, start.w)
    assert.equal(moved.h, start.h)
    assert.ok(moved.x + moved.w <= 1.0001)
    assert.ok(moved.y + moved.h <= 1.0001)
  })

  it('resizes edges independently without locking aspect ratio', () => {
    const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }
    const east = applyLetterCropPointer(start, 'e', 0.1, 0)
    assert.ok(Math.abs(east.w - 0.5) < 1e-9)
    assert.ok(Math.abs(east.h - 0.4) < 1e-9)

    const south = applyLetterCropPointer(start, 's', 0, 0.15)
    assert.ok(Math.abs(south.w - 0.4) < 1e-9)
    assert.ok(Math.abs(south.h - 0.55) < 1e-9)

    const west = applyLetterCropPointer(start, 'w', 0.05, 0)
    assert.ok(west.w < start.w)
    assert.ok(west.x > start.x)
    assert.ok(Math.abs(west.h - start.h) < 1e-9)
  })

  it('maps normalized crop to natural pixels for portrait and landscape', () => {
    const crop = { x: 0.1, y: 0.2, w: 0.5, h: 0.25 }
    const portrait = letterCropToNaturalPixels(crop, 1000, 2000)
    assert.deepEqual(portrait, { sx: 100, sy: 400, sw: 500, sh: 500 })
    const landscape = letterCropToNaturalPixels(crop, 2000, 1000)
    assert.deepEqual(landscape, { sx: 200, sy: 200, sw: 1000, sh: 250 })
  })

  it('rejects invalid tiny crops', () => {
    assert.equal(isLetterCropValid({ x: 0, y: 0, w: 0.01, h: 0.5 }), false)
    assert.equal(isLetterCropValid(initialLetterCrop()), true)
  })

  it('builds a same-origin content URL scoped to document + application ids', () => {
    const url = letterIdentityDocumentContentUrl('doc-1', 'app-2')
    assert.equal(url, '/api/admin/credit-funding/documents/doc-1/content?applicationId=app-2')
    assert.doesNotMatch(url, /^https?:\/\//)
  })
})

describe('letter identity crop wiring', () => {
  it('loads crop pixels via authorized content route and uses freeform handles', () => {
    const modal = readFileSync('src/components/credit-funding/LetterIdentityCropModal.tsx', 'utf8')
    const content = readFileSync(
      'src/app/api/admin/credit-funding/documents/[id]/content/route.ts',
      'utf8'
    )
    const page = readFileSync('src/app/admin/credit-funding/page.tsx', 'utf8')
    assert.match(content, /downloadCreditFundingDocument/)
    assert.match(content, /requireCreditFundingStaffSession/)
    assert.match(content, /creditApplicationAccessDenied/)
    assert.doesNotMatch(content, /createSignedUrl|fetch\(.*req\.url/)
    assert.match(modal, /letterIdentityDocumentContentUrl/)
    assert.match(modal, /createObjectURL/)
    assert.match(modal, /onPointerDown\('e'\)|handle\('e'/)
    assert.match(modal, /handle\('n'/)
    assert.match(modal, /setPointerCapture/)
    assert.match(modal, /Save for letters/)
    assert.match(modal, /setSaveError/)
    assert.match(page, /documentId=\{cropDoc\.id\}/)
    assert.match(page, /applicationId=\{selected\.id\}/)
  })

  it('exports crop canvas from object-URL image without crossOrigin signed URL draw', () => {
    const modal = readFileSync('src/components/credit-funding/LetterIdentityCropModal.tsx', 'utf8')
    assert.match(modal, /canvas\.toBlob/)
    assert.match(modal, /SecurityError/)
    assert.doesNotMatch(modal, /crossOrigin\s*=\s*['"]anonymous['"]/)
    // Must not draw the remote signed URL as the primary crop source
    assert.match(modal, /objectUrl/)
  })
})

describe('synthetic crop pixel export (node canvas-free)', () => {
  it('computes high-resolution crop bounds without overflowing natural size', () => {
    const crop = clampLetterCrop({ x: 0.75, y: 0.75, w: 0.5, h: 0.5 })
    const px = letterCropToNaturalPixels(crop, 4000, 3000)
    assert.ok(px.sx + px.sw <= 4000)
    assert.ok(px.sy + px.sh <= 3000)
    assert.ok(px.sw >= 1 && px.sh >= 1)
  })
})
