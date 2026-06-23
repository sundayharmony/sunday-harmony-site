'use client'

import { useState, useEffect, useMemo } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'

interface Lead {
  id: string; first_name: string; last_name: string; email?: string; phone?: string
  business: string; industry?: string; service?: string; budget?: string; message?: string
  source?: 'inbound' | 'outbound'
  website?: string
  google_place_id?: string
  location_text?: string
  discovered_at?: string
  last_contacted_at?: string
  status: string; notes: string; created_at: string
}

const statuses = ['new', 'contacted', 'audit_sent', 'proposal', 'won', 'lost']
const PAGE_SIZE = 15
const sourceFilters = ['all', 'inbound', 'outbound'] as const

interface ProspectCandidate {
  google_place_id: string
  business: string
  location_text?: string
  phone?: string
  website?: string
  rating?: number | null
  review_count?: number | null
}

interface LeadEditDraft {
  first_name: string
  last_name: string
  email: string
  phone: string
  business: string
  website: string
  location_text: string
  industry: string
  service: string
  budget: string
  message: string
  source: 'inbound' | 'outbound'
  notes: string
}

function leadToDraft(lead: Lead): LeadEditDraft {
  return {
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    business: lead.business || '',
    website: lead.website || '',
    location_text: lead.location_text || '',
    industry: lead.industry || '',
    service: lead.service || '',
    budget: lead.budget || '',
    message: lead.message || '',
    source: lead.source === 'outbound' ? 'outbound' : 'inbound',
    notes: lead.notes || '',
  }
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selected, setSelected] = useState<Lead | null>(null)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<(typeof sourceFilters)[number]>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [savingProspect, setSavingProspect] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discoveryQuery, setDiscoveryQuery] = useState({ service: '', city: '', maxResults: '10' })
  const [prospects, setProspects] = useState<ProspectCandidate[]>([])
  const [quickProspect, setQuickProspect] = useState({
    business: '', first_name: '', last_name: '', phone: '', email: '', website: '', location_text: '', industry: '', service: '',
  })
  const [error, setError] = useState('')
  const [editDraft, setEditDraft] = useState<LeadEditDraft | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)

  useEffect(() => {
    setEditDraft(null)
  }, [selected?.id])

  useEffect(() => {
    const loadLeads = async () => {
      try {
        const r = await fetch('/api/admin/leads')
        if (!r.ok) throw new Error('Failed to load leads')
        const d = await r.json()
        setLeads(d)
        setError('')
      } catch (err) {
        setError('Failed to load leads. Please try again.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadLeads()
  }, [])

  const patchLead = async (id: string, updates: Partial<Lead>): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to update lead')
        return false
      }
      setLeads(prev => prev.map(l => (l.id === id ? body : l)))
      if (selected?.id === id) {
        setSelected(body)
        setNotes(typeof body.notes === 'string' ? body.notes : '')
      }
      setError('')
      return true
    } catch (err) {
      setError('Failed to update lead. Please try again.')
      console.error(err)
      return false
    }
  }

  const saveLeadEdits = async () => {
    if (!selected || !editDraft) return
    const business = editDraft.business.trim()
    if (!business) {
      setError('Business name is required')
      return
    }
    setDetailBusy(true)
    const ok = await patchLead(selected.id, {
      first_name: editDraft.first_name.trim() || 'Prospect',
      last_name: editDraft.last_name.trim(),
      email: editDraft.email.trim() || undefined,
      phone: editDraft.phone.trim() || undefined,
      business,
      website: editDraft.website.trim() || undefined,
      location_text: editDraft.location_text.trim() || undefined,
      industry: editDraft.industry.trim() || undefined,
      service: editDraft.service.trim() || undefined,
      budget: editDraft.budget.trim() || undefined,
      message: editDraft.message.trim() || undefined,
      source: editDraft.source,
      notes: editDraft.notes.trim(),
    })
    setDetailBusy(false)
    if (ok) setEditDraft(null)
  }

  const deleteSelectedLead = async () => {
    if (!selected) return
    const label = `${selected.first_name} ${selected.last_name}`.trim() || selected.business
    if (!window.confirm(`Delete lead "${label}" at ${selected.business}? This cannot be undone.`)) return
    try {
      setDetailBusy(true)
      const res = await fetch('/api/admin/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to delete lead')
        return
      }
      setLeads(prev => prev.filter(l => l.id !== selected.id))
      setSelected(null)
      setEditDraft(null)
      setNotes('')
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to delete lead')
    } finally {
      setDetailBusy(false)
    }
  }

  const createOutboundLead = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Failed to create lead')
    return res.json()
  }

  const addProspectCandidate = async (candidate: ProspectCandidate) => {
    try {
      setSavingProspect(true)
      const response = await createOutboundLead({
        first_name: 'Prospect',
        business: candidate.business,
        phone: candidate.phone || '',
        website: candidate.website || '',
        location_text: candidate.location_text || '',
        google_place_id: candidate.google_place_id || '',
        source: 'outbound',
        discovered_at: new Date().toISOString(),
      })
      if (response?.duplicate && response?.lead) {
        setError(`Lead already exists for ${candidate.business}`)
        setSelected(response.lead)
        setNotes(response.lead.notes || '')
        return
      }
      setLeads(prev => [response, ...prev])
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to add prospect')
    } finally {
      setSavingProspect(false)
    }
  }

  const addQuickProspect = async () => {
    if (!quickProspect.business.trim()) {
      setError('Business name is required')
      return
    }
    try {
      setSavingProspect(true)
      const response = await createOutboundLead({
        ...quickProspect,
        source: 'outbound',
        discovered_at: new Date().toISOString(),
      })
      if (response?.duplicate && response?.lead) {
        setError(`Lead already exists for ${quickProspect.business}`)
        setSelected(response.lead)
        setNotes(response.lead.notes || '')
        return
      }
      setLeads(prev => [response, ...prev])
      setQuickProspect({ business: '', first_name: '', last_name: '', phone: '', email: '', website: '', location_text: '', industry: '', service: '' })
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to add quick prospect')
    } finally {
      setSavingProspect(false)
    }
  }

  const findBusinesses = async () => {
    if (!discoveryQuery.service.trim() || !discoveryQuery.city.trim()) {
      setError('Service and city are required to discover businesses')
      return
    }
    try {
      setDiscovering(true)
      const res = await fetch('/api/admin/leads/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: discoveryQuery.service,
          city: discoveryQuery.city,
          maxResults: parseInt(discoveryQuery.maxResults || '10', 10),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('Discovery request failed', res.status, body)
        setError(typeof body.error === 'string' ? body.error : 'Failed to discover businesses')
        return
      }
      setProspects(Array.isArray(body?.results) ? body.results : [])
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to discover businesses')
    } finally {
      setDiscovering(false)
    }
  }

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !search.trim() ||
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        l.business.toLowerCase().includes(search.toLowerCase()) ||
        (l.email || '').toLowerCase().includes(search.toLowerCase())
      const matchSource = sourceFilter === 'all' || (l.source || 'inbound') === sourceFilter
      const matchStatus = filterStatus === 'all' || l.status === filterStatus
      return matchSearch && matchSource && matchStatus
    })
  }, [leads, search, filterStatus, sourceFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, filterStatus, sourceFilter])

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Business', 'Phone', 'Industry', 'Service', 'Budget', 'Status', 'Notes', 'Date']
    const rows = filtered.map(l => [
      `${l.first_name || ''} ${l.last_name || ''}`, l.email || '', l.business || '', l.phone || '', l.industry || '',
      l.service || '', l.budget || '', l.status || '', l.notes || '', l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Leads</h1>
          <p className="text-sm text-brand-muted">Manage inbound leads and outbound prospecting in one CRM pipeline.</p>
        </div>
        <button onClick={exportCSV} className="px-4 py-2 rounded-lg bg-gray-50 border border-brand-border text-brand-muted text-xs font-semibold hover:text-brand-text transition-all">
          Export CSV
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {statuses.map(s => {
          const count = leads.filter(l => l.status === s).length
          return (
            <div key={s} className="px-3 py-2 rounded-lg bg-gray-50 border border-brand-border text-center min-w-[80px]">
              <div className="text-lg font-bold text-brand-text">{count}</div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-brand-dim">{s.replaceAll('_', ' ')}</div>
            </div>
          )
        })}
      </div>

      {/* Source filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {sourceFilters.map(source => (
          <button
            key={source}
            onClick={() => setSourceFilter(source)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
              sourceFilter === source
                ? 'bg-accent-soft text-accent border border-accent'
                : 'bg-gray-50 border border-brand-border text-brand-dim hover:text-brand-text'
            }`}
          >
            {source}
          </button>
        ))}
      </div>

      {/* Outbound prospecting tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-brand-border rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-brand-text mb-3">Quick Add Prospect</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <input value={quickProspect.business} onChange={e => setQuickProspect(p => ({ ...p, business: e.target.value }))} placeholder="Business *"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={quickProspect.first_name} onChange={e => setQuickProspect(p => ({ ...p, first_name: e.target.value }))} placeholder="Contact first name"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={quickProspect.last_name} onChange={e => setQuickProspect(p => ({ ...p, last_name: e.target.value }))} placeholder="Contact last name"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={quickProspect.phone} onChange={e => setQuickProspect(p => ({ ...p, phone: e.target.value }))} placeholder="Phone"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={quickProspect.email} onChange={e => setQuickProspect(p => ({ ...p, email: e.target.value }))} placeholder="Email"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={quickProspect.website} onChange={e => setQuickProspect(p => ({ ...p, website: e.target.value }))} placeholder="Website"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={quickProspect.location_text} onChange={e => setQuickProspect(p => ({ ...p, location_text: e.target.value }))} placeholder="Location"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={quickProspect.service} onChange={e => setQuickProspect(p => ({ ...p, service: e.target.value }))} placeholder="Service needed"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
          </div>
          <button onClick={addQuickProspect} disabled={savingProspect}
            className="px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold disabled:opacity-60">
            {savingProspect ? 'Saving...' : 'Add Prospect'}
          </button>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-brand-text mb-3">Find Businesses (Google Places)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input value={discoveryQuery.service} onChange={e => setDiscoveryQuery(q => ({ ...q, service: e.target.value }))} placeholder="Service (e.g. dentist)"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={discoveryQuery.city} onChange={e => setDiscoveryQuery(q => ({ ...q, city: e.target.value }))} placeholder="City (e.g. Newark, NJ)"
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
            <input value={discoveryQuery.maxResults} type="number" min={1} max={20} onChange={e => setDiscoveryQuery(q => ({ ...q, maxResults: e.target.value }))}
              className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent" />
          </div>
          <button onClick={findBusinesses} disabled={discovering}
            className="px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold disabled:opacity-60 mb-3">
            {discovering ? 'Searching...' : 'Find Businesses'}
          </button>
          {prospects.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {prospects.map(candidate => (
                <div key={candidate.google_place_id || `${candidate.business}-${candidate.location_text}`} className="p-2 rounded-lg border border-brand-border bg-neutral-50">
                  <div className="text-sm font-semibold text-brand-text">{candidate.business}</div>
                  <div className="text-xs text-brand-muted">{candidate.location_text || 'No address'}</div>
                  <div className="text-xs text-brand-dim">{candidate.phone || candidate.website || 'No contact listed'}</div>
                  <button
                    onClick={() => addProspectCandidate(candidate)}
                    disabled={savingProspect}
                    className="mt-2 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold"
                  >
                    Add to Leads
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, business, or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 py-2.5 px-4 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent placeholder:text-brand-dim"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="py-2.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-muted text-sm outline-none"
        >
          <option value="all">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
        </select>
      </div>

      <div className={`grid ${selected ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : 'grid-cols-1'} gap-6`}>
        {/* Lead Table */}
        <div className="bg-white border border-brand-border rounded-xl overflow-x-auto shadow-sm">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="p-8 text-center text-brand-dim text-sm">
              {search || filterStatus !== 'all' ? 'No leads match your filters.' : "No leads yet. They'll appear here when someone submits the contact form on your website."}
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border">
                    {['Name', 'Business', 'Service', 'Status', 'Date'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(lead => (
                    <tr
                      key={lead.id}
                      tabIndex={0}
                      aria-label={`Open lead ${lead.first_name} ${lead.last_name}, ${lead.business}`}
                      onClick={() => { setSelected(lead); setNotes(lead.notes) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(lead)
                          setNotes(lead.notes)
                        }
                      }}
                      className={`border-b border-gray-200 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                        selected?.id === lead.id ? 'bg-accent-soft' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-brand-text font-medium">{lead.first_name} {lead.last_name}</td>
                      <td className="px-4 py-3 text-sm text-brand-muted">{lead.business}</td>
                      <td className="px-4 py-3 text-xs text-brand-dim">{lead.service || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                      <td className="px-4 py-3 text-xs text-brand-dim">{new Date(lead.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
                  <span className="text-xs text-brand-dim">
                    Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-50 border border-brand-border text-brand-muted disabled:opacity-30 hover:text-brand-text transition-all"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-brand-dim md:hidden px-2">
                      Page {page} of {totalPages}
                    </span>
                    <div className="hidden md:flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-md text-xs font-semibold transition-all ${
                          page === p
                            ? 'bg-accent-soft text-accent border border-accent'
                            : 'bg-gray-50 border border-brand-border text-brand-dim hover:text-brand-text'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    </div>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-50 border border-brand-border text-brand-muted disabled:opacity-30 hover:text-brand-text transition-all"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lead Detail */}
        {selected && (
          <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-lg font-bold text-brand-text">{selected.first_name} {selected.last_name}</h3>
              <button
                type="button"
                onClick={() => { setSelected(null); setEditDraft(null) }}
                className="text-brand-dim hover:text-brand-text text-xs"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-brand-muted mb-3">{selected.business}</div>

            <div className="flex flex-wrap gap-2 mb-4">
              {!editDraft ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditDraft(leadToDraft(selected))}
                    disabled={detailBusy}
                    className="px-3 py-1.5 rounded-lg bg-brand-text text-white text-xs font-bold hover:bg-opacity-90 disabled:opacity-50"
                  >
                    Edit prospect
                  </button>
                  <button
                    type="button"
                    onClick={() => { void deleteSelectedLead() }}
                    disabled={detailBusy}
                    className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { void saveLeadEdits() }}
                    disabled={detailBusy}
                    className="px-3 py-1.5 rounded-lg bg-brand-text text-white text-xs font-bold disabled:opacity-50"
                  >
                    {detailBusy ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDraft(null)}
                    disabled={detailBusy}
                    className="px-3 py-1.5 rounded-lg bg-gray-50 border border-brand-border text-brand-muted text-xs font-semibold hover:text-brand-text disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {editDraft ? (
              <div className="space-y-3 mb-5">
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">First name</div>
                    <input
                      value={editDraft.first_name}
                      onChange={e => setEditDraft(d => (d ? { ...d, first_name: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Last name</div>
                    <input
                      value={editDraft.last_name}
                      onChange={e => setEditDraft(d => (d ? { ...d, last_name: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Business *</div>
                    <input
                      value={editDraft.business}
                      onChange={e => setEditDraft(d => (d ? { ...d, business: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Email</div>
                    <input
                      value={editDraft.email}
                      onChange={e => setEditDraft(d => (d ? { ...d, email: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Phone</div>
                    <input
                      value={editDraft.phone}
                      onChange={e => setEditDraft(d => (d ? { ...d, phone: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Website</div>
                    <input
                      value={editDraft.website}
                      onChange={e => setEditDraft(d => (d ? { ...d, website: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Location</div>
                    <input
                      value={editDraft.location_text}
                      onChange={e => setEditDraft(d => (d ? { ...d, location_text: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Source</div>
                    <select
                      value={editDraft.source}
                      onChange={e =>
                        setEditDraft(d =>
                          d
                            ? { ...d, source: e.target.value === 'outbound' ? 'outbound' : 'inbound' }
                            : d
                        )
                      }
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    >
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Industry</div>
                    <input
                      value={editDraft.industry}
                      onChange={e => setEditDraft(d => (d ? { ...d, industry: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Service</div>
                    <input
                      value={editDraft.service}
                      onChange={e => setEditDraft(d => (d ? { ...d, service: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Budget</div>
                    <input
                      value={editDraft.budget}
                      onChange={e => setEditDraft(d => (d ? { ...d, budget: e.target.value } : d))}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Message</div>
                    <textarea
                      value={editDraft.message}
                      onChange={e => setEditDraft(d => (d ? { ...d, message: e.target.value } : d))}
                      rows={3}
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent resize-y"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Notes</div>
                    <textarea
                      value={editDraft.notes}
                      onChange={e => setEditDraft(d => (d ? { ...d, notes: e.target.value } : d))}
                      rows={4}
                      placeholder="Internal notes…"
                      className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent resize-y"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-5">
                {[
                  ['Email', selected.email],
                  ['Phone', selected.phone],
                  ['Website', selected.website],
                  ['Location', selected.location_text],
                  ['Source', (selected.source || 'inbound').toUpperCase()],
                  ['Industry', selected.industry],
                  ['Service', selected.service],
                  ['Budget', selected.budget],
                  ['Message', selected.message],
                ].map(([label, val]) =>
                  val ? (
                    <div key={label as string}>
                      <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{label}</div>
                      <div className="text-sm text-brand-text">{val}</div>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {/* Status changer */}
            <div className="mb-4">
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Status</div>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map(s => (
                  <button
                    type="button"
                    key={s}
                    disabled={Boolean(editDraft)}
                    onClick={() => { void patchLead(selected.id, { status: s as Lead['status'] }) }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase transition-all ${
                      selected.status === s
                        ? 'bg-accent-soft text-accent border border-accent'
                        : 'bg-gray-50 text-brand-dim border border-brand-border hover:text-brand-text'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {s.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes (view mode only; edit form includes notes) */}
            {!editDraft && (
              <div>
                <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Notes</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes about this lead..."
                  rows={4}
                  className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent resize-y"
                />
                <button
                  type="button"
                  onClick={() => { void patchLead(selected.id, { notes }) }}
                  className="mt-2 px-4 py-2 rounded-lg bg-accent-soft border border-accent text-accent text-xs font-semibold hover:bg-neutral-100 transition-all"
                >
                  Save Notes
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
