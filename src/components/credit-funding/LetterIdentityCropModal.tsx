'use client'

import { useEffect, useRef, useState } from 'react'
import {
  applyLetterCropPointer,
  clampLetterCrop,
  initialLetterCrop,
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
  const imageRef = useRef<HTMLImageElement>(null)
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
    setCrop(initialLetterCrop())
    setSaveError('')
  }

  const save = async () => {
    const image = imageRef.current
    setSaveError('')
    if (!image || !natural.w || !natural.h) {
      setSaveError('Image is still loading. Try again in a moment.')
      return
    }
    if (!isLetterCropValid(crop)) {
      setSaveError('Crop selection is too small. Enlarge the box, then save.')
      return
    }
    try {
      const { sx, sy, sw, sh } = letterCropToNaturalPixels(crop, natural.w, natural.h)
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setSaveError('Could not prepare crop canvas in this browser.')
        return
      }
      // object URL from same-origin authorized fetch — not a cross-origin signed URL
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
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
            <img
              ref={imageRef}
              src={objectUrl}
              alt=""
              className="max-h-[75vh] max-w-full select-none"
              draggable={false}
              onLoad={(event) => {
                const el = event.currentTarget
                setNatural({ w: el.naturalWidth, h: el.naturalHeight })
                setCrop(clampLetterCrop(initialLetterCrop()))
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
      <div className="px-4 pb-4 space-y-1">
        <p className="text-xs text-white/80">
          Drag the box to move, or use edges and corners to resize freely (no locked aspect). The
          original upload stays on the application; letters use this crop.
        </p>
        {saveError && <p className="text-xs text-red-300">{saveError}</p>}
      </div>
    </div>
  )
}
