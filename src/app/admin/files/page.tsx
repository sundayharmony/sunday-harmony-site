'use client'

import { useState, useEffect, useRef } from 'react'

interface Client {
  id: string
  name: string
  business: string
}

interface ClientVaultFile {
  id: string
  client_id: string
  name: string
  file_type: string
  file_size: number
  file_url: string
  category: 'report' | 'graphic' | 'content' | 'brand' | 'general'
  uploaded_by: string
  created_at: string
}

const categoryColors: Record<string, string> = {
  report: 'bg-blue-100 text-blue-700',
  graphic: 'bg-purple-100 text-purple-700',
  content: 'bg-green-100 text-green-700',
  brand: 'bg-amber-100 text-amber-700',
  general: 'bg-gray-100 text-gray-700',
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function formatFileDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function parseFileCategory(value: string): ClientVaultFile['category'] {
  if (value === 'report' || value === 'graphic' || value === 'content' || value === 'brand' || value === 'general') {
    return value
  }
  return 'general'
}

export default function AdminFilesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [files, setFiles] = useState<ClientVaultFile[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadDisplayName, setUploadDisplayName] = useState('')
  const [uploadCategory, setUploadCategory] = useState<ClientVaultFile['category']>('general')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/clients')
        if (!res.ok) throw new Error('Failed to load clients')
        const data = await res.json()
        setClients(data)
        setError('')
      } catch (err) {
        console.error('Failed to load clients:', err)
        setError('Failed to load clients')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    const clientParam = new URLSearchParams(window.location.search).get('client')
    if (clientParam) setSelectedClientId(prev => prev || clientParam)
  }, [])

  useEffect(() => {
    if (!selectedClientId) {
      setFiles([])
      return
    }

    (async () => {
      try {
        const res = await fetch(`/api/admin/files?client_id=${selectedClientId}`)
        if (!res.ok) throw new Error('Failed to load files')
        const data = await res.json()
        setFiles(Array.isArray(data) ? data : [])
        setError('')
      } catch (err) {
        console.error('Failed to load files:', err)
        setError('Failed to load files')
      }
    })()
  }, [selectedClientId])

  const resetUploadForm = () => {
    setUploadDisplayName('')
    setUploadCategory('general')
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadFile = async () => {
    if (!selectedClientId) {
      setError('Select a client first')
      return
    }
    if (!selectedFile) {
      setError('Choose a file from your computer')
      return
    }

    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('client_id', selectedClientId)
      fd.append('file', selectedFile)
      if (uploadDisplayName.trim()) fd.append('name', uploadDisplayName.trim())
      fd.append('category', uploadCategory)

      const res = await fetch('/api/admin/files/upload', {
        method: 'POST',
        body: fd,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Upload failed')
        return
      }
      setFiles(prev => [...prev, body])
      resetUploadForm()
      setShowForm(false)
    } catch (err) {
      console.error(err)
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return

    try {
      const res = await fetch('/api/admin/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fileId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to delete file')
        return
      }
      setFiles(prev => prev.filter(f => f.id !== fileId))
      setError('')
    } catch (err) {
      setError('Failed to delete file')
      console.error(err)
    }
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading files…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Files</h1>
          <p className="text-sm text-brand-muted">Upload files to Supabase Storage for the selected client (max 4 MB per file).</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm)
            if (showForm) resetUploadForm()
          }}
          className="px-4 py-2.5 rounded-lg bg-brand-text text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
        >
          + Upload File
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">
          Select Client
        </label>
        <select
          value={selectedClientId || ''}
          onChange={e => setSelectedClientId(e.target.value || null)}
          className="w-full md:w-64 py-2.5 px-4 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
        >
          <option value="">Choose a client...</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.business})
            </option>
          ))}
        </select>
      </div>

      {showForm && selectedClientId && (
        <div className="bg-accent-soft border border-brand-border rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-accent mb-2">Upload file for {selectedClient?.name}</h3>
          <p className="text-xs text-brand-dim mb-4">
            PDF, images, Word, Excel, CSV, text, or zip. Display name is optional (defaults to the file name).
          </p>
          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                File *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-brand-text file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-text file:text-white file:text-xs file:font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Display name (optional)
              </label>
              <input
                type="text"
                value={uploadDisplayName}
                onChange={e => setUploadDisplayName(e.target.value)}
                maxLength={300}
                placeholder="Shown in the vault (defaults to file name)"
                className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Category
              </label>
              <select
                value={uploadCategory}
                onChange={e => setUploadCategory(parseFileCategory(e.target.value))}
                className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
              >
                <option value="report">Report</option>
                <option value="graphic">Graphic</option>
                <option value="content">Content</option>
                <option value="brand">Brand Assets</option>
                <option value="general">General</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={uploadFile}
                disabled={uploading || !selectedFile}
                className="px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold hover:bg-opacity-90 transition-all disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  resetUploadForm()
                }}
                className="px-4 py-2 rounded-lg text-brand-dim text-xs font-semibold hover:text-brand-text transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedClientId ? (
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
          {files.length === 0 ? (
            <div className="p-8 text-center text-brand-dim text-sm">
              No files for this client yet.
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 gap-0 divide-y divide-brand-border">
                {files.map(file => (
                  <div key={file.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">📄</span>
                          <h3 className="font-bold text-brand-text truncate">{file.name}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded-full ${categoryColors[file.category] ?? categoryColors.general}`}
                          >
                            {(file.category || 'general').replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-[10px] text-brand-dim bg-gray-100 px-2 py-1 rounded-full">
                            {String(file.file_type || '').toUpperCase()}
                          </span>
                          <span className="text-[10px] text-brand-dim bg-gray-100 px-2 py-1 rounded-full">
                            {formatFileSize(file.file_size)}
                          </span>
                          <span className="text-[10px] text-brand-muted">{formatFileDate(file.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {file.file_url && (
                          <a
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-accent-soft text-accent text-xs font-semibold hover:bg-neutral-200 transition-all"
                          >
                            Download
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteFile(file.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-brand-dim">
          <p className="text-sm">Select a client above to view and manage their files</p>
        </div>
      )}
    </div>
  )
}
