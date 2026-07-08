'use client'

import { isPreviewableDocument } from '@/components/credit-funding/DocumentPreviewModal'
import type { PreviewDocument } from '@/components/credit-funding/DocumentPreviewModal'

interface Props {
  fileName: string
  signedUrl?: string
  mimeType?: string
  fileType?: string
  onPreview: (doc: PreviewDocument) => void
  previewLabel?: string
  downloadLabel?: string
  onDelete?: () => void
  deleting?: boolean
  deleteLabel?: string
}

export default function DocumentPreviewActions({
  fileName,
  signedUrl,
  mimeType,
  fileType,
  onPreview,
  previewLabel = 'Preview',
  downloadLabel = 'Download',
  onDelete,
  deleting = false,
  deleteLabel = 'Delete',
}: Props) {
  if (!signedUrl) {
    return <span className="text-xs text-brand-dim shrink-0">Unavailable</span>
  }

  const canPreview = isPreviewableDocument({ mimeType, fileType, file_name: fileName })

  return (
    <div className="flex items-center gap-2 shrink-0">
      {canPreview && (
        <button
          type="button"
          onClick={() => onPreview({ title: fileName, url: signedUrl, mimeType, fileType })}
          className="text-xs font-semibold text-accent hover:underline"
        >
          {previewLabel}
        </button>
      )}
      <a
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-brand-muted hover:text-accent hover:underline"
      >
        {downloadLabel}
      </a>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : deleteLabel}
        </button>
      )}
    </div>
  )
}
