'use client'

import { useState, useEffect, useMemo } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'
import BillingPanel from '@/components/billing/BillingPanel'
import { computeBillingMetrics } from '@/lib/billing-metrics'
import { TIER_LIST_PRICES, type PackageTier } from '@/lib/stripe-catalog'

interface Client {
  id: string; name: string; business: string; email: string; phone?: string
  industry?: string; package_tier: string; monthly_price: number; start_date: string
  status: string
  is_potential?: boolean
  billing_status?: 'not_started' | 'trial' | 'paid' | 'past_due' | 'unpaid'
  stripe_customer_id?: string
  stripe_subscription_id?: string
  last_payment_at?: string
  next_billing_date?: string
  notes: string; deliverables: string[]; quick_wins: { text: string; done: boolean }[]
}

const tierLabels: Record<string, string> = {
  free: 'Free (Testing)',
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

const tierPrices = TIER_LIST_PRICES

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [form, setForm] = useState({
    name: '', business: '', email: '', phone: '', industry: '', packageTier: 'spark', loginPassword: '', isPotential: false,
  })
  const [notes, setNotes] = useState('')
  const [newDeliverable, setNewDeliverable] = useState('')
  const [newQuickWin, setNewQuickWin] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [showBillingAdvanced, setShowBillingAdvanced] = useState(false)
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

  const refreshClientsAndReselect = async (id: string) => {
    try {
      const r = await fetch('/api/admin/clients')
      if (!r.ok) return
      const d: Client[] = await r.json()
      setClients(d)
      const next = d.find(c => c.id === id)
      if (next) {
        setSelected(next)
        setNotes(next.notes ? String(next.notes) : '')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const updateClient = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || 'Failed to update client')
      }
      const updated = await res.json()
      setClients(prev => prev.map(c => c.id === id ? updated : c))
      if (selected?.id === id) setSelected(updated)
      setError('')
      return updated
    } catch (err) {
      console.error(err)
      setError('Failed to update client. Please try again.')
      return null
    }
  }

  const deleteSelectedClient = async () => {
    if (!selected) return
    const label = selected.name.trim() || selected.business
    if (!window.confirm(
      `Delete client "${label}" at ${selected.business}? Their dashboard login, messages, tasks, files, and billing records will be removed. This cannot be undone.`
    )) return

    try {
      setDeleting(true)
      const res = await fetch('/api/admin/clients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to delete client')
        return
      }
      setClients(prev => prev.filter(c => c.id !== selected.id))
      setSelected(null)
      setNotes('')
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to delete client')
    } finally {
      setDeleting(false)
    }
  }

  const addClient = async () => {
    if (!form.name.trim() || !form.business.trim() || !form.email.trim()) {
      setError('Please fill in name, business, and email before creating a client.')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          monthlyPrice: tierPrices[form.packageTier as PackageTier],
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || 'Failed to create client')
      }
      const client = await res.json()
      setClients(prev => [...prev, client])
      setShowForm(false)
      setForm({ name: '', business: '', email: '', phone: '', industry: '', packageTier: 'spark', loginPassword: '', isPotential: false })
      setError('')
    } catch (err) {
      console.error(err)
      setError('Failed to create client. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const setFormField = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const addDeliverable = async () => {
    if (!selected || !newDeliverable.trim()) return
    const currentDeliverables = Array.isArray(selected.deliverables) ? selected.deliverables : []
    const updated = [...currentDeliverables, newDeliverable.trim()]
    await updateClient(selected.id, { deliverables: updated })
    setNewDeliverable('')
  }

  const removeDeliverable = async (index: number) => {
    if (!selected) return
    if (!window.confirm('Are you sure you want to remove this?')) return
    const currentDeliverables = Array.isArray(selected.deliverables) ? selected.deliverables : []
    const updated = currentDeliverables.filter((_, i) => i !== index)
    await updateClient(selected.id, { deliverables: updated })
  }

  const addQuickWin = async () => {
    if (!selected || !newQuickWin.trim()) return
    const currentQuickWins = Array.isArray(selected.quick_wins) ? selected.quick_wins : []
    const updated = [...currentQuickWins, { text: newQuickWin.trim(), done: false }]
    await updateClient(selected.id, { quick_wins: updated })
    setNewQuickWin('')
  }

  const toggleQuickWin = async (index: number) => {
    if (!selected) return
    const currentQuickWins = Array.isArray(selected.quick_wins) ? selected.quick_wins : []
    const updated = currentQuickWins.map((w, i) => i === index ? { ...w, done: !w.done } : w)
    await updateClient(selected.id, { quick_wins: updated })
  }

  const removeQuickWin = async (index: number) => {
    if (!selected) return
    if (!window.confirm('Are you sure you want to remove this?')) return
    const currentQuickWins = Array.isArray(selected.quick_wins) ? selected.quick_wins : []
    const updated = currentQuickWins.filter((_, i) => i !== index)
    await updateClient(selected.id, { quick_wins: updated })
  }

  const active = clients.filter(c => c.status === 'active')
  const billingMetrics = useMemo(() => computeBillingMetrics(clients), [clients])

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

  useEffect(() => {
    const clientParam = new URLSearchParams(window.location.search).get('client')
    if (clientParam && clients.length > 0) {
      const match = clients.find(c => c.id === clientParam)
      if (match) {
        setSelected(match)
        setNotes(match.notes ? String(match.notes) : '')
      }
    }
  }, [clients])

  const exportCSV = () => {
    const headers = ['Name', 'Business', 'Email', 'Phone', 'Industry', 'Package', 'Monthly Price', 'Status', 'Start Date', 'Notes']
    const rows = filtered.map(c => [
      c.name || '', c.business || '', c.email || '', c.phone || '', c.industry || '',
      tierLabels[c.package_tier] || c.package_tier || '', `$${(c.monthly_price || 0).toLocaleString()}`, c.status || '',
      c.start_date ? new Date(c.start_date).toLocaleDateString() : '', c.notes || '',
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
          <p className="text-sm text-brand-muted">
            {active.length} active &bull; ${billingMetrics.contractedMrr.toLocaleString()}/mo contracted
            &bull; ${billingMetrics.stripeMrr.toLocaleString()}/mo Stripe
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2.5 rounded-lg bg-gray-50 border border-brand-border text-brand-muted text-xs font-semibold hover:text-brand-text transition-all">
            Export CSV
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2.5 rounded-lg bg-brand-text text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
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
          className="w-full py-2.5 px-4 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent placeholder:text-brand-dim"
        />
      </div>

      {/* New Client Form */}
      {showForm && (
        <div className="bg-accent-soft border border-brand-border rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-accent mb-4">New Client</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {([
              ['name', 'Full Name *', 'text'],
              ['business', 'Business Name *', 'text'],
              ['email', 'Email *', 'email'],
              ['phone', 'Phone', 'tel'],
              ['industry', 'Industry', 'text'],
              ['loginPassword', 'Dashboard Password', 'text'],
            ] as const).map(([key, label, type]) => (
              <div key={key}>
                <label className="block text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => setFormField(key, e.currentTarget?.value ?? '')}
                  className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent"
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
                  type="button"
                  onClick={() => setForm(f => ({ ...f, packageTier: key }))}
                  disabled={form.isPotential}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    form.packageTier === key
                      ? 'bg-accent-soft text-accent border border-accent'
                      : 'bg-gray-50 text-brand-dim border border-brand-border'
                  } disabled:opacity-50`}
                >
                  {label} (${tierPrices[key as PackageTier]})
                </button>
              ))}
            </div>
          </div>
          <label className="mb-4 flex items-center gap-2 text-xs text-brand-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isPotential}
              onChange={e => {
                const isPotential = (e.target as HTMLInputElement).checked
                setForm(prev => ({ ...prev, isPotential }))
              }}
            />
            Potential client (free until plan is activated)
          </label>
          <div className="flex gap-2">
            <button onClick={addClient} type="button" disabled={saving} className="px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Client'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-brand-dim text-xs hover:text-brand-text">
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
                    {['Client', 'Business', 'Package', 'Monthly', 'Billing', 'Status', 'Since'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                     {paginated.map(client => (
                    <tr
                      key={client.id}
                      onClick={() => { setSelected(client); setNotes(client.notes ? String(client.notes) : '') }}
                      className={`border-b border-gray-200 cursor-pointer transition-colors ${
                        selected?.id === client.id ? 'bg-accent-soft' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-brand-text">{client.name}</td>
                      <td className="px-4 py-3 text-sm text-brand-muted">{client.business}</td>
                      <td className="px-4 py-3 text-xs text-accent font-semibold">{tierLabels[client.package_tier] || client.package_tier}</td>
                      <td className="px-4 py-3 text-sm text-brand-text">${(client.monthly_price || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-[10px] font-semibold uppercase text-brand-muted">
                        {(client.billing_status || 'not_started').replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={client.status} /></td>
                      <td className="px-4 py-3 text-xs text-brand-dim">{client.start_date ? new Date(client.start_date).toLocaleDateString() : '—'}</td>
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
                          page === p ? 'bg-accent-soft text-accent border border-accent' : 'bg-gray-50 border border-brand-border text-brand-dim hover:text-brand-text'
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

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => { void deleteSelectedClient() }}
                disabled={deleting || saving}
                className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete client'}
              </button>
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
                        ? 'bg-accent-soft text-accent border border-accent'
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

            {/* Billing */}
            <div className="mb-4">
              <div className="text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim mb-2">Billing</div>
              <p className="text-xs text-brand-muted mb-3">
                Workflow: Save plan, Activate billing, then Start subscription when a card is on file.
              </p>
              <BillingPanel
                client={selected}
                adminView
                onUpdated={() => void refreshClientsAndReselect(selected.id)}
              />
              <button
                type="button"
                onClick={() => setShowBillingAdvanced(v => !v)}
                className="text-[10px] font-bold uppercase text-accent mt-3 hover:underline"
              >
                {showBillingAdvanced ? 'Hide' : 'Show'} debug (manual Stripe IDs)
              </button>
              {showBillingAdvanced && (
                <div className="grid grid-cols-1 gap-2 mt-2 p-2 rounded-lg border border-dashed border-brand-border bg-white/80">
                  <input
                    type="text"
                    key={`cus-${selected.id}-${selected.stripe_customer_id || ''}`}
                    defaultValue={selected.stripe_customer_id || ''}
                    onBlur={e => updateClient(selected.id, { stripe_customer_id: e.currentTarget.value.trim() })}
                    placeholder="Stripe customer ID"
                    className="w-full py-1.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    key={`sub-${selected.id}-${selected.stripe_subscription_id || ''}`}
                    defaultValue={selected.stripe_subscription_id || ''}
                    onBlur={e => updateClient(selected.id, { stripe_subscription_id: e.currentTarget.value.trim() })}
                    placeholder="Stripe subscription ID"
                    className="w-full py-1.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-accent"
                  />
                </div>
              )}
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
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-accent-soft border border-brand-border">
                      <span className="text-sm text-brand-text flex items-center gap-2">
                        <span className="text-accent text-xs">◈</span> {d}
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
                  className="flex-1 py-1.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-accent"
                />
                <button onClick={addDeliverable} className="px-3 py-1.5 rounded-lg bg-accent-soft text-accent text-xs font-semibold">+</button>
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
                  className="flex-1 py-1.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-accent"
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
                className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-sm outline-none focus:border-accent resize-y"
              />
              <button
                onClick={() => updateClient(selected.id, { notes })}
                className="mt-2 px-4 py-2 rounded-lg bg-accent-soft border border-accent text-accent text-xs font-semibold hover:bg-neutral-100 transition-all"
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
