'use client'

import { useState, useEffect } from 'react'

interface Client {
  id: string
  name: string
  business: string
}

interface File {
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

function parseFileCategory(value: string): File['category'] {
  if (value === 'report' || value === 'graphic' || value === 'content' || value === 'brand' || value === 'general') {
    return value
  }
  return 'general'
}

export default function AdminFilesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<{
    name: string
    file_url: string
    file_type: string
    file_size: string
    category: File['category']
  }>({
    name: '',
    file_url: '',
    file_type: '',
    file_size: '',
    category: 'general',
  })

  // Fetch clients on mount
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

  // Fetch files when client is selected
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
        setFiles(data)
        setError('')
      } catch (err) {
        console.error('Failed to load files:', err)
        setError('Failed to load files')
      }
    })()
  }, [selectedClientId])

  const addFile = async () => {
    if (!selectedClientId || !form.name.trim()) {
      setError('Client and file name are required')
      return
    }

    try {
      const res = await fetch('/api/admin/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId,
          name: form.name.trim(),
          file_url: form.file_url.trim(),
          file_type: form.file_type.trim() || 'generic',
          file_size: form.file_size ? parseInt(form.file_size) : 0,
          category: form.category,
        }),
      })
      if (!res.ok) throw new Error('Failed to create file')
      const newFile = await res.json()
      setFiles(prev => [...prev, newFile])
      setForm({
        name: '',
        file_url: '',
        file_type: '',
        file_size: '',
        category: 'general',
      })
      setShowForm(false)
      setError('')
    } catch (err) {
      setError('Failed to create file')
      console.error(err)
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
      if (!res.ok) throw new Error('Failed to delete file')
      setFiles(prev => prev.filter(f => f.id !== fileId))
      setError('')
    } catch (err) {
      setError('Failed to delete file')
      console.error(err)
    }
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Files</h1>
          <p className="text-sm text-brand-muted">Manage client file sharing and assets</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
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

      {/* Client Selector */}
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

      {/* Upload File Form */}
      {showForm && selectedClientId && (
        <div className="bg-accent-soft border border-brand-border rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-accent mb-4">Upload File for {selectedClient?.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                File Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Q1_Report_2024"
                className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                File Type
              </label>
              <input
                type="text"
                value={form.file_type}
                onChange={e => setForm(f => ({ ...f, file_type: e.target.value }))}
                placeholder="e.g., pdf, png, docx"
                className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                File URL
              </label>
              <input
                type="text"
                value={form.file_url}
                onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))}
                placeholder="https://example.com/file.pdf"
                className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                File Size (bytes)
              </label>
              <input
                type="number"
                value={form.file_size}
                onChange={e => setForm(f => ({ ...f, file_size: e.target.value }))}
                placeholder="e.g., 1048576"
                className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
              Category
            </label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: parseFileCategory(e.target.value) }))}
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
              onClick={addFile}
              className="px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold hover:bg-opacity-90 transition-all"
            >
              Upload File
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-brand-dim text-xs font-semibold hover:text-brand-text transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Files List */}
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
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${categoryColors[file.category]}`}>
                            {file.category.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-[10px] text-brand-dim bg-gray-100 px-2 py-1 rounded-full">
                            {file.file_type.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-brand-dim bg-gray-100 px-2 py-1 rounded-full">
                            {formatFileSize(file.file_size)}
                          </span>
                          <span className="text-[10px] text-brand-muted">
                            {new Date(file.created_at).toLocaleDateString()}
                          </span>
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
