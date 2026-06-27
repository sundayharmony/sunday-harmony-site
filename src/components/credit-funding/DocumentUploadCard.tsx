'use client'

import { useRef, useState } from 'react'
import FileDropzone from '@/components/ui/FileDropzone'
import { CREDIT_FUNDING_MAX_MB, getCreditFundingFileValidationError } from '@/lib/credit-funding-types'
import type { DocumentType } from '@/lib/credit-funding-types'
import type { StagedDocumentState } from '@/components/credit-funding/useStagedDocumentUploads'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg'

interface DocumentUploadCardProps {
  documentType: DocumentType
  label: string
  description: string
  icon: string
  required?: boolean
  state: StagedDocumentState | undefined
  onUpload: (file: File) => Promise<void>
  onRemove: () => void
}

export default function DocumentUploadCard({
  documentType,
  label,
  description,
  icon,
  required,
  state,
  onUpload,
  onRemove,
}: DocumentUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState('')

  const status = state?.status || 'idle'
  const isBusy = status === 'uploading'

  const handleFile = async (file: File | null) => {
    setLocalError('')
    if (!file) return

    const validationError = getCreditFundingFileValidationError(file)
    if (validationError) {
      setLocalError(validationError)
      return
    }

    try {
      await onUpload(file)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const statusLabel =
    status === 'uploaded'
      ? 'Uploaded securely'
      : status === 'uploading'
        ? 'Uploading…'
        : status === 'error'
          ? 'Upload failed'
          : required
            ? 'Required'
            : 'Optional'

  const statusClass =
    status === 'uploaded'
      ? 'bg-green-50 text-green-800 border-green-200'
      : status === 'uploading'
        ? 'bg-blue-50 text-blue-800 border-blue-200'
        : status === 'error' || localError
          ? 'bg-red-50 text-red-800 border-red-200'
          : required
            ? 'bg-amber-50 text-amber-900 border-amber-200'
            : 'bg-neutral-50 text-brand-dim border-brand-border'

  return (
    <FileDropzone
      accept={ACCEPT}
      disabled={isBusy}
      onFile={(file) => void handleFile(file)}
      className={`rounded-xl border-2 transition-colors border-brand-border bg-white ${
        status === 'uploaded' ? 'ring-1 ring-green-200' : ''
      }`}
      activeClassName="border-accent bg-accent-soft/20"
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center text-xl shrink-0">
            {status === 'uploaded' ? '✓' : icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-brand-text leading-snug">
                {label}
                {required && <span className="text-brand-red ml-0.5">*</span>}
              </h4>
              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {state?.fileName && status !== 'idle' && (
          <div className="mb-3 px-3 py-2 bg-neutral-50 rounded-lg border border-brand-border text-xs">
            <p className="font-medium text-brand-text truncate">{state.fileName}</p>
            {state.fileSize != null && (
              <p className="text-brand-dim mt-0.5">{(state.fileSize / 1024 / 1024).toFixed(2)} MB</p>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          name={documentType}
          accept={ACCEPT}
          className="hidden"
          disabled={isBusy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            e.target.value = ''
          }}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-brand-text text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {status === 'uploaded' ? 'Replace file' : status === 'uploading' ? 'Uploading…' : 'Choose file'}
          </button>
          {status === 'uploaded' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={onRemove}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-brand-border text-brand-muted hover:text-brand-red transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        <p className="text-[11px] text-brand-dim mt-2">
          PDF, JPG, or PNG — max {CREDIT_FUNDING_MAX_MB} MB. Drag and drop supported.
        </p>

        {(localError || state?.error) && (
          <p className="text-xs text-brand-red mt-2" role="alert">
            {localError || state?.error}
          </p>
        )}
      </div>
    </FileDropzone>
  )
}
