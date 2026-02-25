'use client'

import { useState, useEffect } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'

interface Lead {
  id: string; first_name: string; last_name: string; email: string; phone?: string
  business: string; industry?: string; service?: string; budget?: string; message?: string
  status: string; notes: string; created_at: string
}

const statuses = ['new', 'contacted', 'audit_sent', 'proposal', 'won', 'lost']

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selected, setSelected] = useState<Lead | null>(null)
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    fetch('/api/admin/leads').then(r => r.json()).then(setLeads)
  }, [])

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const res = await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    const updated = await res.json()
    setLeads(prev => prev.map(l => l.id === id ? updated : l))
    if (selected?.id === id) setSelected(updated)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Leads</h1>
        <p className="text-sm text-brand-muted">Manage contact form submissions and track your pipeline.</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 mb-6">
        {statuses.map(s => {
          const count = leads.filter(l => l.status === s).length
          return (
            <div key={s} className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-center min-w-[80px]">
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
          className="flex-1 py-2.5 px-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg text-brand-text text-sm outline-none focus:border-[rgba(201,169,110,0.3)] placeholder:text-brand-dim"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="py-2.5 px-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg text-brand-muted text-sm outline-none"
        >
          <option value="all">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-6">
        {/* Lead Table */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
          {(() => {
            const filtered = leads.filter(l => {
              const matchSearch = !search.trim() ||
                `${l.first_name} ${l.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
                l.business.toLowerCase().includes(search.toLowerCase()) ||
                l.email.toLowerCase().includes(search.toLowerCase())
              const matchStatus = filterStatus === 'all' || l.status === filterStatus
              return matchSearch && matchStatus
            })
            return filtered.length === 0 ? (
            <div className="p-8 text-center text-brand-dim text-sm">
              {search || filterStatus !== 'all' ? 'No leads match your filters.' : "No leads yet. They'll appear here when someone submits the contact form on your website."}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  {['Name', 'Business', 'Service', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => { setSelected(lead); setNotes(lead.notes) }}
                    className={`border-b border-[rgba(255,255,255,0.04)] cursor-pointer transition-colors ${
                      selected?.id === lead.id ? 'bg-[rgba(201,169,110,0.05)]' : 'hover:bg-[rgba(255,255,255,0.02)]'
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
          )
          })()}
        </div>

        {/* Lead Detail */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
          {selected ? (
            <>
              <h3 className="text-lg font-bold text-brand-text mb-1">{selected.first_name} {selected.last_name}</h3>
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
                          ? 'bg-[rgba(201,169,110,0.15)] text-brand-gold border border-[rgba(201,169,110,0.3)]'
                          : 'bg-[rgba(255,255,255,0.03)] text-brand-dim border border-[rgba(255,255,255,0.06)] hover:text-brand-text'
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
                  className="w-full py-2 px-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg text-brand-text text-sm outline-none focus:border-[rgba(201,169,110,0.3)] resize-y"
                />
                <button
                  onClick={() => updateLead(selected.id, { notes })}
                  className="mt-2 px-4 py-2 rounded-lg bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.3)] text-brand-gold text-xs font-semibold hover:bg-[rgba(201,169,110,0.2)] transition-all"
                >
                  Save Notes
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-sm text-brand-dim">
              Click a lead to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
