'use client'

import { useState, useEffect } from 'react'

interface Client {
  id: string
  name: string
  business: string
}

interface Approval {
  id: string
  client_id: string
  title: string
  description?: string
  content_type: 'social_post' | 'ad_copy' | 'email' | 'blog' | 'graphic' | 'other'
  content_url?: string
  content_text?: string
  admin_notes?: string
  client_feedback?: string
  status: 'pending' | 'approved' | 'revision_requested'
  created_at: string
  updated_at: string
}

const contentTypeColors: Record<string, string> = {
  social_post: 'bg-blue-100 text-blue-700',
  ad_copy: 'bg-orange-100 text-orange-700',
  email: 'bg-green-100 text-green-700',
  blog: 'bg-purple-100 text-purple-700',
  graphic: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-700',
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  revision_requested: 'bg-red-100 text-red-700',
}

export default function AdminApprovalsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    description: '',
    content_type: 'social_post' as const,
    content_url: '',
    content_text: '',
    admin_notes: '',
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

  // Fetch approvals when client is selected
  useEffect(() => {
    if (!selectedClientId) {
      setApprovals([])
      return
    }

    (async () => {
      try {
        const res = await fetch(`/api/admin/approvals?client_id=${selectedClientId}`)
        if (!res.ok) throw new Error('Failed to load approvals')
        const data = await res.json()
        setApprovals(data)
        setError('')
      } catch (err) {
        console.error('Failed to load approvals:', err)
        setError('Failed to load approvals')
      }
    })()
  }, [selectedClientId])

  const addApproval = async () => {
    if (!selectedClientId || !form.title.trim()) {
      setError('Client and title are required')
      return
    }

    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClientId,
          title: form.title.trim(),
          description: form.description.trim(),
          content_type: form.content_type,
          content_url: form.content_url.trim(),
          content_text: form.content_text.trim(),
          admin_notes: form.admin_notes.trim(),
          status: 'pending',
        }),
      })
      if (!res.ok) throw new Error('Failed to create approval')
      const newApproval = await res.json()
      setApprovals(prev => [...prev, newApproval])
      setForm({
        title: '',
        description: '',
        content_type: 'social_post',
        content_url: '',
        content_text: '',
        admin_notes: '',
      })
      setShowForm(false)
      setError('')
    } catch (err) {
      setError('Failed to create approval')
      console.error(err)
    }
  }

  const updateApprovalStatus = async (approvalId: string, newStatus: Approval['status']) => {
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approvalId, status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update approval')
      const updated = await res.json()
      setApprovals(prev => prev.map(a => a.id === approvalId ? updated : a))
      setError('')
    } catch (err) {
      setError('Failed to update approval')
      console.error(err)
    }
  }

  const deleteApproval = async (approvalId: string) => {
    if (!window.confirm('Are you sure you want to delete this approval?')) return

    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: approvalId }),
      })
      if (!res.ok) throw new Error('Failed to delete approval')
      setApprovals(prev => prev.filter(a => a.id !== approvalId))
      setError('')
    } catch (err) {
      setError('Failed to delete approval')
      console.error(err)
    }
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)

  // Summary stats
  const stats = {
    pending: approvals.filter(a => a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    revisionRequested: approvals.filter(a => a.status === 'revision_requested').length,
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Approvals</h1>
          <p className="text-sm text-brand-muted">Manage content approvals and client feedback</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 rounded-lg bg-brand-gold text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
        >
          + New Approval
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
          className="w-full md:w-64 py-2.5 px-4 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
        >
          <option value="">Choose a client...</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.business})
            </option>
          ))}
        </select>
      </div>

      {/* Summary Stats */}
      {selectedClientId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Pending</div>
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          </div>
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Approved</div>
            <div className="text-2xl font-bold text-brand-green">{stats.approved}</div>
          </div>
          <div className="bg-white border border-brand-border rounded-lg p-4">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Revisions Needed</div>
            <div className="text-2xl font-bold text-red-600">{stats.revisionRequested}</div>
          </div>
        </div>
      )}

      {/* New Approval Form */}
      {showForm && selectedClientId && (
        <div className="bg-[rgba(184,148,63,0.05)] border border-[rgba(184,148,63,0.2)] rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-brand-gold mb-4">New Approval Request for {selectedClient?.name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Q1 Social Media Campaign"
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Content Type
              </label>
              <select
                value={form.content_type}
                onChange={e => setForm(f => ({ ...f, content_type: e.target.value as any }))}
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
              >
                <option value="social_post">Social Post</option>
                <option value="ad_copy">Ad Copy</option>
                <option value="email">Email</option>
                <option value="blog">Blog Post</option>
                <option value="graphic">Graphic</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of what needs approval..."
              rows={2}
              className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
                Content URL (optional)
              </label>
              <input
                type="text"
                value={form.content_url}
                onChange={e => setForm(f => ({ ...f, content_url: e.target.value }))}
                placeholder="https://example.com/content"
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
              Content Text (optional)
            </label>
            <textarea
              value={form.content_text}
              onChange={e => setForm(f => ({ ...f, content_text: e.target.value }))}
              placeholder="Paste content for approval here..."
              rows={3}
              className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold resize-none"
            />
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">
              Admin Notes
            </label>
            <textarea
              value={form.admin_notes}
              onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))}
              placeholder="Instructions or context for the client..."
              rows={2}
              className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addApproval}
              className="px-4 py-2 rounded-lg bg-brand-gold text-white text-xs font-bold hover:bg-opacity-90 transition-all"
            >
              Create Approval Request
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

      {/* Approvals List */}
      {selectedClientId ? (
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
          {approvals.length === 0 ? (
            <div className="p-8 text-center text-brand-dim text-sm">
              No approval requests for this client yet.
            </div>
          ) : (
            <div className="divide-y divide-brand-border">
              {approvals.map(approval => (
                <div key={approval.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-brand-text mb-2">{approval.title}</h3>
                      {approval.description && (
                        <p className="text-xs text-brand-muted mb-2">{approval.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${contentTypeColors[approval.content_type]}`}>
                          {approval.content_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColors[approval.status]}`}>
                          {approval.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-[10px] text-brand-dim">
                          {new Date(approval.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Content Preview */}
                      {(approval.content_text || approval.content_url) && (
                        <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-brand-border">
                          {approval.content_text && (
                            <p className="text-xs text-brand-text font-mono mb-2 line-clamp-2">
                              {approval.content_text}
                            </p>
                          )}
                          {approval.content_url && (
                            <a
                              href={approval.content_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand-gold font-semibold hover:underline"
                            >
                              View Content ↗
                            </a>
                          )}
                        </div>
                      )}

                      {/* Admin Notes */}
                      {approval.admin_notes && (
                        <div className="bg-[rgba(184,148,63,0.04)] rounded-lg p-3 mb-3 border border-[rgba(184,148,63,0.15)]">
                          <div className="text-[10px] font-bold text-brand-gold mb-1">ADMIN NOTES</div>
                          <p className="text-xs text-brand-text">{approval.admin_notes}</p>
                        </div>
                      )}

                      {/* Client Feedback */}
                      {approval.client_feedback && approval.status === 'revision_requested' && (
                        <div className="bg-red-50 rounded-lg p-3 mb-3 border border-red-200">
                          <div className="text-[10px] font-bold text-red-700 mb-1">CLIENT FEEDBACK</div>
                          <p className="text-xs text-red-700">{approval.client_feedback}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={approval.status}
                        onChange={e => updateApprovalStatus(approval.id, e.target.value as Approval['status'])}
                        className="py-1.5 px-2 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-brand-gold"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="revision_requested">Revision Requested</option>
                      </select>
                      <button
                        onClick={() => deleteApproval(approval.id)}
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
      ) : (
        <div className="text-center py-12 text-brand-dim">
          <p className="text-sm">Select a client above to view and manage their approval requests</p>
        </div>
      )}
    </div>
  )
}
