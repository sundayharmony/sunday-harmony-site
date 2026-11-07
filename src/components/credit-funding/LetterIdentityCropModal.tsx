'use client'

import { useEffect, useRef, useState } from 'react'

type CropRect = { x: number; y: number; w: number; h: number }

export default function LetterIdentityCropModal({
  title,
  imageUrl,
  fileName,
  onCancel,
  onSave,
  saving = false,
}: {
  title: string
  imageUrl: string
  fileName: string
  onCancel: () => void
  onSave: (file: File) => void
  saving?: boolean
}) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const drag = useRef<{ kind: string; startX: number; startY: number; crop: CropRect } | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, saving])

  const clampCrop = (next: CropRect): CropRect => {
    const x = Math.min(Math.max(next.x, 0), 0.95)
    const y = Math.min(Math.max(next.y, 0), 0.95)
    const w = Math.min(Math.max(next.w, 0.08), 1 - x)
    const h = Math.min(Math.max(next.h, 0.08), 1 - y)
    return { x, y, w, h }
  }

  const onPointerDown = (kind: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { kind, startX: event.clientX, startY: event.clientY, crop }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !imageRef.current) return
    const box = imageRef.current.getBoundingClientRect()
    const dx = (event.clientX - drag.current.startX) / box.width
    const dy = (event.clientY - drag.current.startY) / box.height
    const start = drag.current.crop
    const kind = drag.current.kind
    let next = { ...start }
    if (kind === 'move') {
      next = { ...start, x: start.x + dx, y: start.y + dy }
    } else {
      if (kind.includes('w')) {
        next.x = start.x + dx
        next.w = start.w - dx
      }
      if (kind.includes('e')) next.w = start.w + dx
      if (kind.includes('n')) {
        next.y = start.y + dy
        next.h = start.h - dy
      }
      if (kind.includes('s')) next.h = start.h + dy
    }
    setCrop(clampCrop(next))
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const save = async () => {
    const image = imageRef.current
    if (!image || !natural.w || !natural.h) return
    const sx = Math.round(crop.x * natural.w)
    const sy = Math.round(crop.y * natural.h)
    const sw = Math.max(1, Math.round(crop.w * natural.w))
    const sh = Math.max(1, Math.round(crop.h * natural.h))
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) return
    const base = fileName.replace(/\.[^.]+$/, '') || 'letter-copy'
    onSave(new File([blob], `${base}-cropped.jpg`, { type: 'image/jpeg' }))
  }

  const handle = (kind: string, className: string) => (
    <div
      role="presentation"
      className={`absolute bg-white border border-accent shadow ${className}`}
      onPointerDown={onPointerDown(kind)}
    />
  )

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
            onClick={onCancel}
            disabled={saving}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !natural.w}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save for letters'}
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <div className="relative max-h-full max-w-full touch-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <img
            ref={imageRef}
            src={imageUrl}
            alt={title}
            className="max-h-[75vh] max-w-full select-none"
            draggable={false}
            onLoad={(event) => {
              setNatural({
                w: event.currentTarget.naturalWidth,
                h: event.currentTarget.naturalHeight,
              })
            }}
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
          >
            {handle('nw', 'w-3 h-3 -left-1.5 -top-1.5 cursor-nwse-resize')}
            {handle('ne', 'w-3 h-3 -right-1.5 -top-1.5 cursor-nesw-resize')}
            {handle('sw', 'w-3 h-3 -left-1.5 -bottom-1.5 cursor-nesw-resize')}
            {handle('se', 'w-3 h-3 -right-1.5 -bottom-1.5 cursor-nwse-resize')}
          </div>
        </div>
      </div>
      <p className="px-4 pb-4 text-xs text-white/80">
        Drag the box to crop the original. The original file stays on the application; letters use this crop.
      </p>
    </div>
  )
}
