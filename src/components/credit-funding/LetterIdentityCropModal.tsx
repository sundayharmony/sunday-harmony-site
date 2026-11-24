'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyLetterCropPointer,
  clampLetterCrop,
  detectLetterCard,
  drawRotated,
  initialLetterCrop,
  normalizeAngle,
  isLetterCropValid,
  letterCropToNaturalPixels,
  letterIdentityDocumentContentUrl,
  type LetterCropRect,
} from '@/lib/letter-identity-crop'

export default function LetterIdentityCropModal({
  title,
  fileName,
  documentId,
  applicationId,
  /** Optional preview URL; crop pixels always load via authorized same-origin content fetch. */
  imageUrl: _legacySignedUrl,
  onCancel,
  onSave,
  saving = false,
}: {
  title: string
  fileName: string
  documentId: string
  applicationId: string
  imageUrl?: string
  onCancel: () => void
  onSave: (file: File) => void | Promise<void>
  saving?: boolean
}) {
  void _legacySignedUrl
  const imageRef = useRef<HTMLCanvasElement>(null)
  const bitmapRef = useRef<ImageBitmap | null>(null)
  const [angle, setAngle] = useState(0)
  const [detected, setDetected] = useState<{ angle: number; crop: LetterCropRect } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busyLoad, setBusyLoad] = useState(true)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [crop, setCrop] = useState<LetterCropRect>(initialLetterCrop())
  const drag = useRef<{ kind: string; startX: number; startY: number; crop: LetterCropRect } | null>(
    null
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, saving])

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null
    setBusyLoad(true)
    setLoadError('')
    setSaveError('')
    setNatural({ w: 0, h: 0 })
    setCrop(initialLetterCrop())
    setObjectUrl(null)

    const contentUrl = letterIdentityDocumentContentUrl(documentId, applicationId)
    ;(async () => {
      try {
        const res = await fetch(contentUrl, { credentials: 'same-origin', cache: 'no-store' })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error || `Could not load image (${res.status})`)
        }
        const type = res.headers.get('content-type') || ''
        if (type.includes('application/pdf')) {
          throw new Error('PDF cannot be cropped here. Upload a JPG or PNG of the ID photo.')
        }
        const blob = await res.blob()
        if (cancelled) return
        // Phone photos carry their orientation in EXIF; decode them upright.
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
        if (cancelled) {
          bitmap.close()
          return
        }
        bitmapRef.current?.close()
        bitmapRef.current = bitmap
        const small = drawRotated(bitmap, 0, 360)
        const found = detectLetterCard(small.getContext('2d')!.getImageData(0, 0, small.width, small.height))
        setDetected(found)
        setAngle(found?.angle ?? 0)
        setCrop(found?.crop ?? initialLetterCrop())
        setNatural({ w: bitmap.width, h: bitmap.height })
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load image for crop')
        }
      } finally {
        if (!cancelled) setBusyLoad(false)
      }
    })()

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [documentId, applicationId])

  useEffect(() => () => bitmapRef.current?.close(), [])

  // Redraw the rotated preview whenever the angle changes.
  useEffect(() => {
    const bitmap = bitmapRef.current
    const target = imageRef.current
    if (!bitmap || !target || !objectUrl) return
    const frame = requestAnimationFrame(() => {
      const preview = drawRotated(bitmap, angle, 1400)
      target.width = preview.width
      target.height = preview.height
      target.getContext('2d')?.drawImage(preview, 0, 0)
    })
    return () => cancelAnimationFrame(frame)
  }, [angle, objectUrl])

  /** Turn by a quarter: the crop box turns with the picture. */
  const turn = useCallback((clockwise: boolean) => {
    setAngle((a) => normalizeAngle(Math.round(a + (clockwise ? 90 : -90))))
    setCrop((c) =>
      clampLetterCrop(clockwise ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w })
    )
  }, [])

  const onPointerDown = (kind: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (saving || busyLoad || !objectUrl) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { kind, startX: event.clientX, startY: event.clientY, crop }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !imageRef.current) return
    const box = imageRef.current.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) return
    const dx = (event.clientX - drag.current.startX) / box.width
    const dy = (event.clientY - drag.current.startY) / box.height
    setCrop(applyLetterCropPointer(drag.current.crop, drag.current.kind, dx, dy))
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    drag.current = null
  }

  const resetCrop = () => {
    setAngle(0)
    setCrop(initialLetterCrop())
    setSaveError('')
  }

  const autoStraighten = () => {
    if (!detected) return
    setAngle(detected.angle)
    setCrop(detected.crop)
    setSaveError('')
  }

  const save = async () => {
    const bitmap = bitmapRef.current
    setSaveError('')
    if (!bitmap || !natural.w || !natural.h) {
      setSaveError('Image is still loading. Try again in a moment.')
      return
    }
    if (!isLetterCropValid(crop)) {
      setSaveError('Crop selection is too small. Enlarge the box, then save.')
      return
    }
    try {
      // Full-resolution rotation, then the crop in the rotated picture.
      const rotated = drawRotated(bitmap, angle)
      const { sx, sy, sw, sh } = letterCropToNaturalPixels(crop, rotated.width, rotated.height)
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setSaveError('Could not prepare crop canvas in this browser.')
        return
      }
      // object URL from same-origin authorized fetch — not a cross-origin signed URL
      ctx.drawImage(rotated, sx, sy, sw, sh, 0, 0, sw, sh)
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        try {
          canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92)
        } catch (err) {
          reject(err)
        }
      })
      if (!blob) {
        setSaveError('Could not export the crop. Try a different selection.')
        return
      }
      const base = fileName.replace(/\.[^.]+$/, '') || 'letter-copy'
      await onSave(new File([blob], `${base}-cropped.jpg`, { type: 'image/jpeg' }))
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'SecurityError'
          ? 'Could not export crop (browser security). Reload and try again.'
          : err instanceof Error
            ? err.message
            : 'Save failed'
      setSaveError(message)
    }
  }

  const handle = (kind: string, className: string) => (
    <div
      role="presentation"
      className={`absolute bg-white border border-accent shadow touch-none ${className}`}
      onPointerDown={onPointerDown(kind)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )

  const canSave = !saving && !busyLoad && Boolean(objectUrl) && natural.w > 0 && isLetterCropValid(crop)

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/85 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Crop ${title}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/40 text-white shrink-0">
        <p className="text-sm font-semibold truncate">Crop for letters — {title}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={resetCrop}
            disabled={saving || busyLoad || !objectUrl}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save for letters'}
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        {busyLoad && <p className="text-sm text-white/80">Loading image…</p>}
        {loadError && !busyLoad && (
          <p className="text-sm text-red-300 max-w-md text-center px-4">{loadError}</p>
        )}
        {objectUrl && !loadError && (
          <div
            ref={stageRef}
            className="relative max-h-full max-w-full touch-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas
              ref={imageRef}
              role="img"
              aria-label={`${title}, turned ${Math.round(angle)} degrees`}
              className="block max-h-[62vh] max-w-full select-none"
            />
            <div
              className="absolute border-2 border-accent bg-accent/10 cursor-move"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
              onPointerDown={onPointerDown('move')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {handle('n', 'left-1/2 -translate-x-1/2 -top-1.5 w-8 h-3 cursor-ns-resize')}
              {handle('s', 'left-1/2 -translate-x-1/2 -bottom-1.5 w-8 h-3 cursor-ns-resize')}
              {handle('w', 'top-1/2 -translate-y-1/2 -left-1.5 w-3 h-8 cursor-ew-resize')}
              {handle('e', 'top-1/2 -translate-y-1/2 -right-1.5 w-3 h-8 cursor-ew-resize')}
              {handle('nw', 'w-3 h-3 -left-1.5 -top-1.5 cursor-nwse-resize')}
              {handle('ne', 'w-3 h-3 -right-1.5 -top-1.5 cursor-nesw-resize')}
              {handle('sw', 'w-3 h-3 -left-1.5 -bottom-1.5 cursor-nesw-resize')}
              {handle('se', 'w-3 h-3 -right-1.5 -bottom-1.5 cursor-nwse-resize')}
            </div>
          </div>
        )}
      </div>
      <div className="px-4 pb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-white">
          <button
            type="button"
            onClick={() => turn(false)}
            disabled={saving || busyLoad || !objectUrl}
            aria-label="Turn left 90 degrees"
            className="min-h-11 px-3 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-50"
          >
            ⟲ 90°
          </button>
          <button
            type="button"
            onClick={() => turn(true)}
            disabled={saving || busyLoad || !objectUrl}
            aria-label="Turn right 90 degrees"
            className="min-h-11 px-3 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-50"
          >
            90° ⟳
          </button>
          <label className="flex flex-1 min-w-[200px] items-center gap-2 text-xs">
            <span className="shrink-0">Angle</span>
            <input
              type="range"
              min={0}
              max={359.5}
              step={0.5}
              value={angle}
              disabled={saving || busyLoad || !objectUrl}
              onChange={(event) => setAngle(Number(event.target.value))}
              className="flex-1 accent-[#b8943f] min-h-11"
              aria-label="Rotation angle in degrees"
            />
            <input
              type="number"
              min={0}
              max={359.5}
              step={0.5}
              value={Number(angle.toFixed(1))}
              disabled={saving || busyLoad || !objectUrl}
              onChange={(event) => setAngle(normalizeAngle(Number(event.target.value) || 0))}
              className="w-16 rounded-md bg-white/10 px-2 py-1 text-right text-white"
              aria-label="Rotation angle, degrees"
            />
            <span>°</span>
          </label>
          <button
            type="button"
            onClick={autoStraighten}
            disabled={saving || busyLoad || !detected}
            title={detected ? 'Straighten and crop to the card found in the photo' : 'No card edge found in this photo'}
            className="min-h-11 px-3 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-50"
          >
            Auto-straighten
          </button>
        </div>
        <p className="text-xs text-white/80">
          {detected
            ? 'The card was found and straightened. Adjust the box or angle if needed.'
            : 'No clear card edge found: turn and crop by hand.'}{' '}
          Drag the box to move it, or its edges and corners to resize. The original upload stays on the
          application; letters use this crop.
        </p>
        {saveError && <p className="text-xs text-red-300">{saveError}</p>}
      </div>
    </div>
  )
}
