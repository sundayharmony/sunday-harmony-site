'use client'

import { useState, useEffect, useMemo } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'

interface Lead {
  id: string; first_name: string; last_name: string; email: string; phone?: string
  business: string; industry?: string; service?: string; budget?: string; message?: string
  status: string; notes: string; created_at: string
}

const statuses = ['new', 'contacted', 'audit_sent', 'proposal', 'won', 'lost']
const PAGE_SIZE = 15

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selected, setSelected] = useState<Lead | null>(null)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
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
    })()
  }, [])

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (!res.ok) throw new Error('Failed to update lead')
      const updated = await res.json()
      setLeads(prev => prev.map(l => l.id === id ? updated : l))
      if (selected?.id === id) setSelected(updated)
      setError('')
    } catch (err) {
      setError('Failed to update lead. Please try again.')
      console.error(err)
    }
  }

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !search.trim() ||
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        l.business.toLowerCase().includes(search.toLowerCase()) ||
        l.email.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || l.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [leads, search, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, filterStatus])

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Business', 'Phone', 'Industry', 'Service', 'Budget', 'Status', 'Notes', 'Date']
    const rows = filtered.map(l => [
      `${l.first_name} ${l.last_name}`, l.email, l.business, l.phone || '', l.industry || '',
      l.service || '', l.budget || '', l.status, l.notes || '', new Date(l.created_at).toLocaleDateString(),
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
          <p className="text-sm text-brand-muted">Manage contact form submissions and track your pipeline.</p>
        </div>
        <button onClick={exportCSV} className="px-4 py-2 rounded-lg bg-gray-50 border border-brand-border text-brand-muted text-xs font-semibold hover:text-brand-text transition-all">
          Export CSV
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {statuses.map(s => {
          const count = leads.filter(l => l.status === s).length
          return (
            <div key={s} className="px-3 py-2 rounded-lg bg-gray-50 border border-brand-border text-center min-w-[80px]">
              <div className="text-lg font-bold text-brand-text">{count}</div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase text-brand-dim">{s.replace('_', ' ')}</div>
            </div>
          )
        })}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, business, or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 py-2.5 px-4 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold placeholder:text-brand-dim"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="py-2.5 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-muted text-sm outline-none"
        >
          <option value="all">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      <div className={`grid ${selected ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : 'grid-cols-1'} gap-6`}>
        {/* Lead Table */}
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
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
                      onClick={() => { setSelected(lead); setNotes(lead.notes) }}
                      className={`border-b border-gray-200 cursor-pointer transition-colors ${
                        selected?.id === lead.id ? 'bg-[rgba(184,148,63,0.04)]' : 'hover:bg-gray-50'
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-50 border border-brand-border text-brand-muted disabled:opacity-30 hover:text-brand-text transition-all"
                    >
                      ← Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-md text-xs font-semibold transition-all ${
                          page === p
                            ? 'bg-[rgba(184,148,63,0.1)] text-brand-gold border border-brand-gold'
                            : 'bg-gray-50 border border-brand-border text-brand-dim hover:text-brand-text'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
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
              <button onClick={() => setSelected(null)} className="text-brand-dim hover:text-brand-text text-xs">✕</button>
            </div>
            <div className="text-sm text-brand-muted mb-4">{selected.business}</div>

            <div className="space-y-3 mb-5">
              {[
                ['Email', selected.email],
                ['Phone', selected.phone],
                ['Industry', selected.industry],
                ['Service', selected.service],
                ['Budget', selected.budget],
                ['Message', selected.message],
              ].map(([label, val]) => val ? (
                <div key={label as string}>
                  <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{label}</div>
                  <div className="text-sm text-brand-text">{val}</div>
                </div>
              ) : null)}
            </div>

            {/* Status changer */}
            <div className="mb-4">
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Status</div>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map(s => (
                  <button
                    key={s}
                    onClick={() => updateLead(selected.id, { status: s as Lead['status'] })}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase transition-all ${
                      selected.status === s
                        ? 'bg-[rgba(184,148,63,0.1)] text-brand-gold border border-brand-gold'
                        : 'bg-gray-50 text-brand-dim border border-brand-border hover:text-brand-text'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Notes</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes about this lead..."
                rows={4}
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold resize-y"
              />
              <button
                onClick={() => updateLead(selected.id, { notes })}
                className="mt-2 px-4 py-2 rounded-lg bg-[rgba(184,148,63,0.1)] border border-brand-gold text-brand-gold text-xs font-semibold hover:bg-[rgba(184,148,63,0.15)] transition-all"
              >
                Save Notes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
