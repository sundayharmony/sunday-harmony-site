'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyLetterCropPointer,
  clampLetterCrop,
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
  const [active, setActive] = useState(false)
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
        setAngle(0)
        setCrop(initialLetterCrop())
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
    setActive(true)
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
    setActive(false)
  }

  /** Arrow keys nudge the box (Shift for bigger steps). */
  const onBoxKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setCrop((c) => applyLetterCropPointer(c, 'move', move[0], move[1]))
  }

  const nudge = (deg: number) => setAngle((a) => normalizeAngle(Math.round((a + deg) * 2) / 2))

  const resetCrop = () => {
    setAngle(0)
    setCrop(initialLetterCrop())
    setSaveError('')
  }

  const selectAll = () => {
    setCrop({ x: 0, y: 0, w: 1, h: 1 })
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

  const ready = !saving && !busyLoad && Boolean(objectUrl)
  const canSave = ready && natural.w > 0 && isLetterCropValid(crop)
  // Show -180..180 so small tilts either way sit near the middle of the slider.
  const signed = angle > 180 ? angle - 360 : angle
  const shownAngle = Number(signed.toFixed(1))

  // A 44px touch target around each grip; the visible part is the gold mark inside it.
  const grip = (kind: string, place: string, cursor: string, mark: React.ReactNode) => (
    <div
      role="presentation"
      className={`absolute z-10 flex h-11 w-11 items-center justify-center touch-none ${place} ${cursor}`}
      onPointerDown={onPointerDown(kind)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {mark}
    </div>
  )
  const corner = (rot: string) => (
    <span className={`block h-5 w-5 border-l-[3px] border-t-[3px] border-accent ${rot}`} aria-hidden />
  )
  const bar = (vertical: boolean) => (
    <span className={`block rounded-full bg-accent ${vertical ? 'h-7 w-[3px]' : 'h-[3px] w-7'}`} aria-hidden />
  )

  const base =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40'
  const pill = `${base} px-4`
  const outline = 'border border-white/20 text-[#fbf7f0] hover:border-accent hover:text-accent'
  const ghost = `${pill} ${outline}`
  const iconBtn = `${base} ${outline} h-11 w-11 shrink-0`

  const RotateIcon = ({ flip }: { flip?: boolean }) => (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${flip ? '-scale-x-100' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-[#1b1a17] text-[#fbf7f0]"
      role="dialog"
      aria-modal="true"
      aria-label={`Crop ${title}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Crop for letters</p>
          <h2 className="truncate font-serif text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
        </div>
        <button type="button" onClick={onCancel} disabled={saving} aria-label="Close" className={iconBtn}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
        {busyLoad && <p className="text-sm text-white/70">Loading image…</p>}
        {loadError && !busyLoad && <p className="max-w-md px-4 text-center text-sm text-red-300">{loadError}</p>}
        {objectUrl && !loadError && (
          <div
            ref={stageRef}
            className="relative max-h-full max-w-full overflow-hidden rounded-md touch-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas
              ref={imageRef}
              role="img"
              aria-label={`${title}, turned ${Math.round(angle)} degrees`}
              className="block max-h-[calc(100dvh-300px)] max-w-full select-none sm:max-h-[calc(100dvh-240px)]"
            />
            <div
              tabIndex={0}
              role="group"
              aria-label="Crop area. Drag to move, or use the arrow keys."
              onKeyDown={onBoxKey}
              className="absolute cursor-move outline-none ring-accent focus-visible:ring-2"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                boxShadow: '0 0 0 9999px rgba(27, 26, 23, 0.62)',
              }}
              onPointerDown={onPointerDown('move')}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="pointer-events-none absolute inset-0 border border-accent/80" />
              {/* Thirds guides show while dragging, to help line the card up. */}
              <div
                className={`pointer-events-none absolute inset-0 transition-opacity motion-reduce:transition-none ${active ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden
              >
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              </div>
              {grip('nw', '-left-[11px] -top-[11px] justify-start items-start p-[9px]', 'cursor-nwse-resize', corner(''))}
              {grip('ne', '-right-[11px] -top-[11px] justify-end items-start p-[9px]', 'cursor-nesw-resize', corner('rotate-90'))}
              {grip('se', '-right-[11px] -bottom-[11px] justify-end items-end p-[9px]', 'cursor-nwse-resize', corner('rotate-180'))}
              {grip('sw', '-left-[11px] -bottom-[11px] justify-start items-end p-[9px]', 'cursor-nesw-resize', corner('-rotate-90'))}
              {grip('n', 'left-1/2 -translate-x-1/2 -top-[22px]', 'cursor-ns-resize', bar(false))}
              {grip('s', 'left-1/2 -translate-x-1/2 -bottom-[22px]', 'cursor-ns-resize', bar(false))}
              {grip('w', 'top-1/2 -translate-y-1/2 -left-[22px]', 'cursor-ew-resize', bar(true))}
              {grip('e', 'top-1/2 -translate-y-1/2 -right-[22px]', 'cursor-ew-resize', bar(true))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-4 border-t border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Rotate</span>
          <div className="flex flex-1 items-center gap-3">
            <input
              type="range"
              min={-180}
              max={180}
              step={0.5}
              value={signed}
              disabled={!ready}
              onPointerDown={() => setActive(true)}
              onPointerUp={() => setActive(false)}
              onChange={(event) => setAngle(normalizeAngle(Number(event.target.value)))}
              className="h-11 flex-1 cursor-pointer accent-[#b8943f] disabled:cursor-not-allowed"
              aria-label="Rotation angle in degrees"
            />
            <label className="flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-sm tabular-nums">
              <input
                type="number"
                min={-180}
                max={180}
                step={0.5}
                value={shownAngle}
                disabled={!ready}
                onChange={(event) => setAngle(normalizeAngle(Number(event.target.value) || 0))}
                className="w-12 bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Rotation angle, degrees"
              />
              <span aria-hidden>°</span>
            </label>
          </div>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => turn(false)} disabled={!ready} aria-label="Turn left 90 degrees" title="Turn left 90°" className={iconBtn}>
              <RotateIcon />
            </button>
            <button type="button" onClick={() => nudge(-1)} disabled={!ready} aria-label="Turn left 1 degree" className={iconBtn}>
              −1°
            </button>
            <button type="button" onClick={() => nudge(1)} disabled={!ready} aria-label="Turn right 1 degree" className={iconBtn}>
              +1°
            </button>
            <button type="button" onClick={() => turn(true)} disabled={!ready} aria-label="Turn right 90 degrees" title="Turn right 90°" className={iconBtn}>
              <RotateIcon flip />
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button type="button" onClick={resetCrop} disabled={!ready} className={ghost}>
              Reset
            </button>
            <button type="button" onClick={selectAll} disabled={!ready} className={ghost}>
              Whole image
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={onCancel} disabled={saving} className={ghost}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className={`${pill} bg-accent text-[#1b1a17] hover:bg-[#c4a052]`}
            >
              {saving ? 'Saving…' : 'Save for letters'}
            </button>
          </div>
        </div>
        {saveError ? (
          <p className="text-center text-xs text-red-300">{saveError}</p>
        ) : (
          <p className="text-center text-xs text-white/55">
            Drag the box or its corners. The original upload is kept; letters use this crop.
          </p>
        )}
      </div>
    </div>
  )
}
