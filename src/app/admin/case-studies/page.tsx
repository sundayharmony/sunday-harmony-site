'use client'

import { useEffect, useRef, useState } from 'react'

interface Client {
  id: string
  name: string
  business: string
}

interface CaseStudyRecord {
  id: string
  client_id: string
  title: string
  file_url: string
  file_size: number
  published: boolean
  uploaded_by_name: string
  updated_at: string
  client_name: string
  client_business: string
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
  const [clients, setClients] = useState<Client[]>([])
  const [caseStudies, setCaseStudies] = useState<CaseStudyRecord[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [published, setPublished] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
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
        const [clientsRes] = await Promise.all([
          fetch('/api/admin/clients'),
        ])
        if (!clientsRes.ok) throw new Error('Failed to load clients')
        const clientsData = await clientsRes.json()
        setClients(Array.isArray(clientsData) ? clientsData : [])
        await loadCaseStudies()
        setError('')
      } catch (err) {
        console.error(err)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const existingForClient = caseStudies.find((cs) => cs.client_id === selectedClientId)

  useEffect(() => {
    if (!selectedClient) {
      setTitle('')
      return
    }
    if (existingForClient) {
      setTitle(existingForClient.title)
      setPublished(existingForClient.published)
    } else {
      setTitle(selectedClient.business || selectedClient.name)
      setPublished(true)
    }
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [selectedClientId, existingForClient, selectedClient])

  const resetForm = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSuccess('')
  }

  const uploadCaseStudy = async () => {
    if (!selectedClientId) {
      setError('Select a client first')
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
      fd.append('client_id', selectedClientId)
      fd.append('file', selectedFile)
      if (title.trim()) fd.append('title', title.trim())
      fd.append('published', published ? 'true' : 'false')

      const res = await fetch('/api/admin/case-studies', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Upload failed')
        return
      }

      await loadCaseStudies()
      resetForm()
      setSuccess(existingForClient ? 'Case study replaced successfully.' : 'Case study uploaded successfully.')
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
    if (!window.confirm(`Delete the case study for ${record.client_name || record.title}?`)) return

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
            Upload one PDF per client for the public{' '}
            <a href="/case-studies" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Case Studies
            </a>{' '}
            page (max 10 MB, PDF only).
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
          <h2 className="text-sm font-bold text-brand-text mb-4">Upload / Replace</h2>

          <div className="mb-4">
            <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">
              Client *
            </label>
            <select
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(e.target.value || null)}
              className="w-full py-2.5 px-4 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
            >
              <option value="">Choose a client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.business})
                </option>
              ))}
            </select>
          </div>

          {selectedClientId && (
            <div className="space-y-4">
              {existingForClient && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  This client already has a case study. Uploading a new PDF will replace it.
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                  Display title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Defaults to client business name"
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
                disabled={uploading || !selectedFile}
                className="px-4 py-2.5 rounded-lg bg-brand-text text-white text-sm font-bold hover:bg-opacity-90 transition-all disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : existingForClient ? 'Replace PDF' : 'Upload PDF'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-accent-soft border border-brand-border rounded-xl p-6">
          <h2 className="text-sm font-bold text-accent mb-2">Tips</h2>
          <ul className="text-xs text-brand-dim space-y-2 list-disc pl-4">
            <li>One PDF per client — ideal for a single-page results snapshot.</li>
            <li>Unpublished case studies stay in admin but are hidden from the public page.</li>
            <li>Use a clear title; client name tabs appear on the public page.</li>
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
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-brand-text truncate">{record.title}</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          record.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {record.published ? 'PUBLISHED' : 'DRAFT'}
                      </span>
                    </div>
                    <p className="text-xs text-brand-muted mb-2">
                      {[record.client_name, record.client_business].filter(Boolean).join(' · ')}
                    </p>
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
                      onClick={() => {
                        setSelectedClientId(record.client_id)
                        setSuccess('')
                        setError('')
                      }}
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
