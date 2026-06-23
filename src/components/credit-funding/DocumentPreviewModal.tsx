'use client'

import { useEffect } from 'react'

export interface PreviewDocument {
  title: string
  url: string
  mimeType?: string
  fileType?: string
}

function isImageDoc(doc: PreviewDocument): boolean {
  if (doc.mimeType?.startsWith('image/')) return true
  const name = doc.title.toLowerCase()
  return /\.(png|jpe?g|gif|webp)$/.test(name) || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(doc.fileType || '')
}

function isPdfDoc(doc: PreviewDocument): boolean {
  if (doc.mimeType === 'application/pdf') return true
  return doc.title.toLowerCase().endsWith('.pdf') || doc.fileType === 'pdf'
}

interface Props {
  document: PreviewDocument | null
  onClose: () => void
}

export default function DocumentPreviewModal({ document: doc, onClose }: Props) {
  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc, onClose])

  if (!doc) return null

  const image = isImageDoc(doc)
  const pdf = isPdfDoc(doc)

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${doc.title}`}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/40 text-white shrink-0">
        <p className="text-sm font-semibold truncate">{doc.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Open in new tab
          </a>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-brand-text hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center p-4 min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {image && (
          <img
            src={doc.url}
            alt={doc.title}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        )}
        {pdf && (
          <iframe
            src={doc.url}
            title={doc.title}
            className="w-full h-full max-w-5xl bg-white rounded-lg shadow-2xl"
          />
        )}
        {!image && !pdf && (
          <div className="bg-white rounded-xl p-8 text-center max-w-md">
            <p className="text-sm text-brand-muted mb-4">Preview is not available for this file type.</p>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-accent hover:underline"
            >
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export function isPreviewableDocument(doc: {
  mimeType?: string
  fileType?: string
  file_name?: string
  title?: string
}): boolean {
  const name = (doc.file_name || doc.title || '').toLowerCase()
  if (doc.mimeType?.startsWith('image/') || doc.mimeType === 'application/pdf') return true
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(doc.fileType || '')) return true
  return /\.(png|jpe?g|gif|webp|pdf)$/.test(name)
}
