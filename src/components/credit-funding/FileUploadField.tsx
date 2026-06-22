'use client'

import { useRef, useState } from 'react'
import { CREDIT_FUNDING_MAX_BYTES } from '@/lib/credit-funding-types'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState('')

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      return 'Allowed types: PDF, JPG, JPEG, PNG'
    }
    if (file.size > CREDIT_FUNDING_MAX_BYTES) {
      return `File too large (max ${CREDIT_FUNDING_MAX_BYTES / (1024 * 1024)} MB)`
    }
    return null
  }

  const handleFile = (file: File | null) => {
    setLocalError('')
    if (!file) {
      onChange(null)
      return
    }
    const err = validateFile(file)
    if (err) {
      setLocalError(err)
      onChange(null)
      return
    }
    onChange(file)
  }

  const previewUrl = value && value.type.startsWith('image/') ? URL.createObjectURL(value) : null

  return (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-brand-red ml-0.5">*</span>}
        {optional && <span className="text-brand-dim font-normal ml-1">(optional)</span>}
      </label>

      <div
        className={`border-2 border-dashed rounded-xl p-5 transition-colors cursor-pointer ${
          dragOver ? 'border-accent bg-accent-soft/30' : 'border-brand-border hover:border-accent/50'
        } ${error || localError ? 'border-brand-red/50' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      >
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
        />

        {!value ? (
          <div className="text-center">
            <div className="text-2xl mb-2">📎</div>
            <p className="text-sm text-brand-muted">Drag & drop or click to upload</p>
            <p className="text-xs text-brand-dim mt-1">PDF, JPG, JPEG, PNG — max 4 MB each</p>
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
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="text-xs text-brand-red hover:underline px-2 py-1"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {(error || localError) && (
        <p className="text-xs text-brand-red mt-1">{error || localError}</p>
      )}
    </div>
  )
}
