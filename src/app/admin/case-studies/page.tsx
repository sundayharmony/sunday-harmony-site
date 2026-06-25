'use client'

import { useEffect, useRef, useState } from 'react'

interface CaseStudyRecord {
  id: string
  title: string
  file_url: string
  file_size: number
  published: boolean
  uploaded_by_name: string
  updated_at: string
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export default function AdminCaseStudiesPage() {
  const [caseStudies, setCaseStudies] = useState<CaseStudyRecord[]>([])
  const [title, setTitle] = useState('')
  const [published, setPublished] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadCaseStudies = async () => {
    const res = await fetch('/api/admin/case-studies')
    if (!res.ok) throw new Error('Failed to load case studies')
    const data = await res.json()
    setCaseStudies(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    ;(async () => {
      try {
        await loadCaseStudies()
        setError('')
      } catch (err) {
        console.error(err)
        setError('Failed to load case studies')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const replacing = replaceId ? caseStudies.find((cs) => cs.id === replaceId) : null

  const resetForm = () => {
    setTitle('')
    setPublished(true)
    setReplaceId(null)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSuccess('')
  }

  const startReplace = (record: CaseStudyRecord) => {
    setReplaceId(record.id)
    setTitle(record.title)
    setPublished(record.published)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSuccess('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const uploadCaseStudy = async () => {
    if (!title.trim()) {
      setError('Enter a display title')
      return
    }
    if (!selectedFile) {
      setError('Choose a PDF file')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('file', selectedFile)
      fd.append('published', published ? 'true' : 'false')
      if (replaceId) fd.append('replace_id', replaceId)

      const res = await fetch('/api/admin/case-studies', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Upload failed')
        return
      }

      await loadCaseStudies()
      resetForm()
      setSuccess(replaceId ? 'Case study replaced successfully.' : 'Case study uploaded successfully.')
    } catch (err) {
      console.error(err)
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const togglePublished = async (record: CaseStudyRecord) => {
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/case-studies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id, published: !record.published }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Update failed')
        return
      }
      await loadCaseStudies()
      setSuccess(`Case study ${!record.published ? 'published' : 'unpublished'}.`)
    } catch (err) {
      console.error(err)
      setError('Update failed')
    }
  }

  const deleteCaseStudy = async (record: CaseStudyRecord) => {
    if (!window.confirm(`Delete "${record.title}"?`)) return

    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/case-studies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Delete failed')
        return
      }
      if (replaceId === record.id) resetForm()
      await loadCaseStudies()
      setSuccess('Case study deleted.')
    } catch (err) {
      console.error(err)
      setError('Delete failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading case studies…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Case Studies</h1>
          <p className="text-sm text-brand-muted">
            Upload PDF case studies for the public{' '}
            <a href="/case-studies" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Case Studies
            </a>{' '}
            page (max 50 MB, PDF only).
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-brand-text mb-4">
            {replacing ? 'Replace case study' : 'Upload case study'}
          </h2>

          {replacing && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex justify-between items-start gap-3">
              <span>Replacing &ldquo;{replacing.title}&rdquo;. Choose a new PDF below.</span>
              <button
                type="button"
                onClick={resetForm}
                className="shrink-0 text-amber-900 underline font-semibold"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Display title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Clean to the Macks"
                className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                PDF file *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-brand-text file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-text file:text-white file:text-xs file:font-bold"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-brand-muted cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded border-brand-border"
              />
              Publish on public Case Studies page
            </label>

            <button
              type="button"
              onClick={uploadCaseStudy}
              disabled={uploading || !selectedFile || !title.trim()}
              className="px-4 py-2.5 rounded-lg bg-brand-text text-white text-sm font-bold hover:bg-opacity-90 transition-all disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : replacing ? 'Replace PDF' : 'Upload PDF'}
            </button>
          </div>
        </div>

        <div className="bg-accent-soft border border-brand-border rounded-xl p-6">
          <h2 className="text-sm font-bold text-accent mb-2">Tips</h2>
          <ul className="text-xs text-brand-dim space-y-2 list-disc pl-4">
            <li>Upload any PDF — no client link required.</li>
            <li>Unpublished case studies stay in admin but are hidden from the public page.</li>
            <li>Use a clear title; it appears as a tab on the public page.</li>
          </ul>
        </div>
      </div>

      <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-brand-border">
          <h2 className="text-sm font-bold text-brand-text">All case studies ({caseStudies.length})</h2>
        </div>
        {caseStudies.length === 0 ? (
          <div className="p-8 text-center text-brand-dim text-sm">No case studies uploaded yet.</div>
        ) : (
          <div className="divide-y divide-brand-border">
            {caseStudies.map((record) => (
              <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-bold text-brand-text truncate">{record.title}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          record.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {record.published ? 'PUBLISHED' : 'DRAFT'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-brand-dim">
                      <span className="bg-gray-100 px-2 py-1 rounded-full">{formatFileSize(record.file_size)}</span>
                      <span className="bg-gray-100 px-2 py-1 rounded-full">Updated {formatDate(record.updated_at)}</span>
                      <span className="bg-gray-100 px-2 py-1 rounded-full">By {record.uploaded_by_name}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={record.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-accent-soft text-accent text-xs font-semibold hover:bg-neutral-200 transition-all"
                    >
                      Preview
                    </a>
                    <button
                      type="button"
                      onClick={() => togglePublished(record)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-100 text-brand-text text-xs font-semibold hover:bg-neutral-200 transition-all"
                    >
                      {record.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startReplace(record)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-100 text-brand-text text-xs font-semibold hover:bg-neutral-200 transition-all"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCaseStudy(record)}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
