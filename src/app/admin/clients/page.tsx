'use client'

import { useState, useEffect, useMemo } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'

interface Client {
  id: string; name: string; business: string; email: string; phone?: string
  industry?: string; package_tier: string; monthly_price: number; start_date: string
  status: string; notes: string; deliverables: string[]; quick_wins: { text: string; done: boolean }[]
}

const tierLabels: Record<string, string> = {
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

const tierPrices: Record<string, number> = {
  social_essentials: 250, spark: 500, growth: 1800, scale: 3500,
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', industry: '', packageTier: 'spark', loginPassword: '' })
  const [notes, setNotes] = useState('')
  const [newDeliverable, setNewDeliverable] = useState('')
  const [newQuickWin, setNewQuickWin] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const PAGE_SIZE = 15

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/clients')
        if (!r.ok) throw new Error('Failed to load clients')
        const d = await r.json()
        setClients(d)
        setError('')
      } catch (err) {
        setError('Failed to load clients. Please try again.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const updateClient = async (id: string, updates: Record<string, unknown>) => {
    const res = await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    const updated = await res.json()
    setClients(prev => prev.map(c => c.id === id ? updated : c))
    if (selected?.id === id) setSelected(updated)
    return updated
  }

  const addClient = async () => {
    const res = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, monthlyPrice: tierPrices[form.packageTier] }),
    })
    const client = await res.json()
    setClients(prev => [...prev, client])
    setShowForm(false)
    setForm({ name: '', business: '', email: '', phone: '', industry: '', packageTier: 'spark', loginPassword: '' })
  }

  const addDeliverable = async () => {
    if (!selected || !newDeliverable.trim()) return
    const updated = [...(selected.deliverables || []), newDeliverable.trim()]
    await updateClient(selected.id, { deliverables: updated })
    setNewDeliverable('')
  }

  const removeDeliverable = async (index: number) => {
    if (!selected) return
    if (!window.confirm('Are you sure you want to remove this?')) return
    const updated = selected.deliverables.filter((_, i) => i !== index)
    await updateClient(selected.id, { deliverables: updated })
  }

  const addQuickWin = async () => {
    if (!selected || !newQuickWin.trim()) return
    const updated = [...(selected.quick_wins || []), { text: newQuickWin.trim(), done: false }]
    await updateClient(selected.id, { quick_wins: updated })
    setNewQuickWin('')
  }

  const toggleQuickWin = async (index: number) => {
    if (!selected) return
    const updated = selected.quick_wins.map((w, i) => i === index ? { ...w, done: !w.done } : w)
    await updateClient(selected.id, { quick_wins: updated })
  }

  const removeQuickWin = async (index: number) => {
    if (!selected) return
    if (!window.confirm('Are you sure you want to remove this?')) return
    const updated = selected.quick_wins.filter((_, i) => i !== index)
    await updateClient(selected.id, { quick_wins: updated })
  }

  const active = clients.filter(c => c.status === 'active')
  const mrr = active.reduce((s, c) => s + c.monthly_price, 0)

  const filtered = useMemo(() => {
    return search.trim()
      ? clients.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.business.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
        )
      : clients
  }, [clients, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])

  const exportCSV = () => {
    const headers = ['Name', 'Business', 'Email', 'Phone', 'Industry', 'Package', 'Monthly Price', 'Status', 'Start Date', 'Notes']
    const rows = filtered.map(c => [
      c.name, c.business, c.email, c.phone || '', c.industry || '',
      tierLabels[c.package_tier] || c.package_tier, `$${c.monthly_price}`, c.status,
      new Date(c.start_date).toLocaleDateString(), c.notes || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Clients</h1>
          <p className="text-sm text-brand-muted">{active.length} active &bull; ${mrr.toLocaleString()}/mo MRR</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2.5 rounded-lg bg-gray-50 border border-brand-border text-brand-muted text-xs font-semibold hover:text-brand-text transition-all">
            Export CSV
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2.5 rounded-lg bg-brand-gold text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
          >
            + Add Client
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search clients by name, business, or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full py-2.5 px-4 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold placeholder:text-brand-dim"
        />
      </div>

      {/* New Client Form */}
      {showForm && (
        <div className="bg-[rgba(184,148,63,0.05)] border border-[rgba(184,148,63,0.2)] rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-brand-gold mb-4">New Client</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              ['name', 'Full Name *', 'text'],
              ['business', 'Business Name *', 'text'],
              ['email', 'Email *', 'email'],
              ['phone', 'Phone', 'tel'],
              ['industry', 'Industry', 'text'],
              ['loginPassword', 'Dashboard Password', 'text'],
            ].map(([key, label, type]) => (
              <div key={key}>
                <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold"
                />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">Package</label>
            <div className="flex gap-2">
              {Object.entries(tierLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setForm(f => ({ ...f, packageTier: key }))}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    form.packageTier === key
                      ? 'bg-[rgba(184,148,63,0.1)] text-brand-gold border border-brand-gold'
                      : 'bg-gray-50 text-brand-dim border border-brand-border'
                  }`}
                >
                  {label} (${tierPrices[key]})
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addClient} className="px-4 py-2 rounded-lg bg-brand-gold text-white text-xs font-bold">
              Create Client
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-brand-dim text-xs hover:text-brand-text">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={`grid ${selected ? 'grid-cols-1 lg:grid-cols-[1fr_380px]' : 'grid-cols-1'} gap-6`}>
        {/* Client Table */}
        <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="p-8 text-center text-brand-dim text-sm">
              {search ? 'No clients match your search.' : 'No clients yet. Add your first client above.'}
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border">
                    {['Client', 'Business', 'Package', 'Monthly', 'Status', 'Since'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(client => (
                    <tr
                      key={client.id}
                      onClick={() => { setSelected(client); setNotes(client.notes || '') }}
                      className={`border-b border-gray-200 cursor-pointer transition-colors ${
                        selected?.id === client.id ? 'bg-[rgba(184,148,63,0.04)]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-brand-text">{client.name}</td>
                      <td className="px-4 py-3 text-sm text-brand-muted">{client.business}</td>
                      <td className="px-4 py-3 text-xs text-brand-gold font-semibold">{tierLabels[client.package_tier]}</td>
                      <td className="px-4 py-3 text-sm text-brand-text">${client.monthly_price.toLocaleString()}</td>
                      <td className="px-4 py-3"><StatusBadge status={client.status} /></td>
                      <td className="px-4 py-3 text-xs text-brand-dim">{new Date(client.start_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
                  <span className="text-xs text-brand-dim">
                    Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-50 border border-brand-border text-brand-muted disabled:opacity-30 hover:text-brand-text transition-all">
                      ← Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-md text-xs font-semibold transition-all ${
                          page === p ? 'bg-[rgba(184,148,63,0.1)] text-brand-gold border border-brand-gold' : 'bg-gray-50 border border-brand-border text-brand-dim hover:text-brand-text'
                        }`}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-50 border border-brand-border text-brand-muted disabled:opacity-30 hover:text-brand-text transition-all">
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Client Detail Panel */}
        {selected && (
          <div className="bg-white border border-brand-border rounded-xl p-5 overflow-y-auto max-h-[calc(100vh-12rem)] shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-brand-text">{selected.name}</h3>
                <div className="text-sm text-brand-muted">{selected.business}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-brand-dim hover:text-brand-text text-xs">✕</button>
            </div>

            {/* Status */}
            <div className="mb-4">
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Status</div>
              <div className="flex gap-1.5">
                {['active', 'paused', 'churned'].map(s => (
                  <button
                    key={s}
                    onClick={() => updateClient(selected.id, { status: s })}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                      selected.status === s
                        ? 'bg-[rgba(184,148,63,0.1)] text-brand-gold border border-brand-gold'
                        : 'bg-gray-50 text-brand-dim border border-brand-border hover:text-brand-text'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="space-y-2 mb-4">
              {[
                ['Email', selected.email],
                ['Phone', selected.phone],
                ['Industry', selected.industry],
                ['Package', tierLabels[selected.package_tier]],
              ].map(([label, val]) => val ? (
                <div key={label as string}>
                  <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{label}</div>
                  <div className="text-sm text-brand-text">{val}</div>
                </div>
              ) : null)}
            </div>

            {/* Quick Links */}
            <div className="mb-4 flex gap-2 flex-wrap">
              <a href={`/admin/tasks?client=${selected.id}`}
                className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition-colors">
                ✅ Tasks
              </a>
              <a href={`/admin/files?client=${selected.id}`}
                className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold hover:bg-purple-100 transition-colors">
                📁 Files
              </a>
              <a href={`/admin/approvals?client=${selected.id}`}
                className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold hover:bg-amber-100 transition-colors">
                📋 Approvals
              </a>
            </div>

            {/* Deliverables */}
            <div className="mb-4">
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Deliverables</div>
              {selected.deliverables && selected.deliverables.length > 0 ? (
                <div className="space-y-1.5 mb-2">
                  {selected.deliverables.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[rgba(184,148,63,0.04)] border border-[rgba(184,148,63,0.15)]">
                      <span className="text-sm text-brand-text flex items-center gap-2">
                        <span className="text-brand-gold text-xs">◈</span> {d}
                      </span>
                      <button onClick={() => removeDeliverable(i)} className="text-brand-dim hover:text-brand-red text-xs">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-dim mb-2">No deliverables set.</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDeliverable}
                  onChange={e => setNewDeliverable(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDeliverable()}
                  placeholder="Add deliverable..."
                  className="flex-1 py-1.5 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-brand-gold"
                />
                <button onClick={addDeliverable} className="px-3 py-1.5 rounded-lg bg-[rgba(184,148,63,0.1)] text-brand-gold text-xs font-semibold">+</button>
              </div>
            </div>

            {/* Quick Wins */}
            <div className="mb-4">
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Quick Wins</div>
              {selected.quick_wins && selected.quick_wins.length > 0 ? (
                <div className="space-y-1.5 mb-2">
                  {selected.quick_wins.map((w, i) => (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-lg ${
                      w.done
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <button
                        onClick={() => toggleQuickWin(i)}
                        className={`flex items-center gap-2 text-sm ${w.done ? 'text-brand-muted line-through' : 'text-brand-text'}`}
                      >
                        <span className={w.done ? 'text-brand-green' : 'text-brand-dim'}>
                          {w.done ? '✓' : '○'}
                        </span>
                        {w.text}
                      </button>
                      <button onClick={() => removeQuickWin(i)} className="text-brand-dim hover:text-brand-red text-xs">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-dim mb-2">No quick wins set.</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newQuickWin}
                  onChange={e => setNewQuickWin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addQuickWin()}
                  placeholder="Add quick win..."
                  className="flex-1 py-1.5 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-brand-gold"
                />
                <button onClick={addQuickWin} className="px-3 py-1.5 rounded-lg bg-green-100 text-brand-green text-xs font-semibold">+</button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Notes</div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes about this client..."
                rows={3}
                className="w-full py-2 px-3 bg-[#fafaf8] border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-brand-gold resize-y"
              />
              <button
                onClick={() => updateClient(selected.id, { notes })}
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
