'use client'

import { useEffect, useState } from 'react'
import FileDropzone from '@/components/ui/FileDropzone'
import { CREDIT_FUNDING_MAX_MB, getCreditFundingFileValidationError } from '@/lib/credit-funding-types'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg'

interface FileUploadFieldProps {
  label: string
  name: string
  required?: boolean
  optional?: boolean
  value: File | null
  onChange: (file: File | null) => void
  error?: string
}

export default function FileUploadField({
  label,
  name,
  required,
  optional,
  value,
  onChange,
  error,
}: FileUploadFieldProps) {
  const [localError, setLocalError] = useState('')

  const handleFile = (file: File | null) => {
    setLocalError('')
    if (!file) {
      onChange(null)
      return
    }
    const err = getCreditFundingFileValidationError(file)
    if (err) {
      setLocalError(err)
      onChange(null)
      return
    }
    onChange(file)
  }

  const previewUrl = value && value.type.startsWith('image/') ? URL.createObjectURL(value) : null

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-brand-red ml-0.5">*</span>}
        {optional && <span className="text-brand-dim font-normal ml-1">(optional)</span>}
      </label>

      <FileDropzone
        accept={ACCEPT}
        onFile={(file) => handleFile(file)}
        clickToSelect
        className={`border-2 border-dashed rounded-xl p-5 transition-colors cursor-pointer border-brand-border hover:border-accent/50 ${
          error || localError ? 'border-brand-red/50' : ''
        }`}
        activeClassName="border-accent bg-accent-soft/30"
      >
        {!value ? (
          <div className="text-center">
            <div className="text-2xl mb-2">📎</div>
            <p className="text-sm text-brand-muted">Drag & drop or click to upload</p>
            <p className="text-xs text-brand-dim mt-1">PDF, JPG, JPEG, PNG — max {CREDIT_FUNDING_MAX_MB} MB each</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-brand-border" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-accent-soft border border-brand-border flex items-center justify-center text-2xl">
                📄
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-text truncate">{value.name}</p>
              <p className="text-xs text-brand-dim">{(value.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="text-xs text-brand-red hover:underline px-2 py-1"
            >
              Remove
            </button>
          </div>
        )}
      </FileDropzone>

      {(error || localError) && <p className="text-xs text-brand-red mt-1">{error || localError}</p>}
    </div>
  )
}
