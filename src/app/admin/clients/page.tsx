'use client'

import { useState, useEffect, useMemo } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'

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

interface StripeInvoiceRow {
  id: string
  number: string | null
  status: string | null
  amount_paid: number
  currency: string
  hosted_invoice_url: string | null
  created: number
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
  const [error, setError] = useState('')
  const [billingStripeError, setBillingStripeError] = useState('')
  const [stripeAction, setStripeAction] = useState<string | null>(null)
  const [adminInvoices, setAdminInvoices] = useState<StripeInvoiceRow[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [showBillingAdvanced, setShowBillingAdvanced] = useState(false)
  const [checkoutTier, setCheckoutTier] = useState<string>('spark')
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
          monthlyPrice: form.isPotential ? 0 : tierPrices[form.packageTier],
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

  const setBillingStatus = async (billingStatus: NonNullable<Client['billing_status']>) => {
    if (!selected) return
    await updateClient(selected.id, { billing_status: billingStatus })
  }

  const activatePotentialClient = async () => {
    if (!selected) return
    await updateClient(selected.id, {
      is_potential: false,
      monthly_price: tierPrices[selected.package_tier] || selected.monthly_price || 0,
      billing_status: 'not_started',
    })
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

  useEffect(() => {
    if (selected?.package_tier) setCheckoutTier(selected.package_tier)
  }, [selected?.id, selected?.package_tier])

  useEffect(() => {
    if (!selected?.id || !selected.stripe_customer_id?.trim()) {
      setAdminInvoices([])
      return
    }
    let cancelled = false
    setInvoicesLoading(true)
    ;(async () => {
      try {
        const r = await fetch(`/api/admin/stripe/invoices?clientId=${encodeURIComponent(selected.id)}`)
        const d = await r.json().catch(() => ({}))
        if (cancelled) return
        if (!r.ok) setAdminInvoices([])
        else setAdminInvoices(Array.isArray(d.invoices) ? d.invoices : [])
      } catch {
        if (!cancelled) setAdminInvoices([])
      } finally {
        if (!cancelled) setInvoicesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [selected?.id, selected?.stripe_customer_id])

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
          <p className="text-sm text-brand-muted">{active.length} active &bull; ${mrr.toLocaleString()}/mo MRR</p>
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
                  {label} (${tierPrices[key]})
                </button>
              ))}
            </div>
          </div>
          <label className="mb-4 flex items-center gap-2 text-xs text-brand-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isPotential}
              onChange={e => setForm(prev => ({ ...prev, isPotential: e.currentTarget.checked }))}
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
                    {['Client', 'Business', 'Package', 'Monthly', 'Status', 'Since'].map(h => (
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
              <div className="text-xs text-brand-muted mb-2">
                Mode: {selected.is_potential ? 'Potential (Free)' : 'Active Billing'}
              </div>
              <div className="text-xs text-brand-muted mb-2">
                Payment: {selected.billing_status || 'not_started'}
              </div>
              {selected.last_payment_at && (
                <div className="text-xs text-brand-dim mb-2">
                  Last payment: {new Date(selected.last_payment_at).toLocaleDateString()}
                </div>
              )}
              {selected.next_billing_date && (
                <div className="text-xs text-brand-dim mb-2">
                  Next billing: {new Date(selected.next_billing_date).toLocaleDateString()}
                </div>
              )}

              {billingStripeError && (
                <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px]">
                  {billingStripeError}
                </div>
              )}

              <div className="rounded-lg border border-brand-border bg-neutral-50 p-3 mb-3">
                <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Stripe actions</div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    title={selected.stripe_customer_id ? 'Customer already linked' : ''}
                    disabled={Boolean(selected.stripe_customer_id?.trim()) || stripeAction !== null}
                    onClick={async () => {
                      setBillingStripeError('')
                      setStripeAction('customer')
                      try {
                        const res = await fetch('/api/admin/stripe/customer', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ clientId: selected.id }),
                        })
                        const payload = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(payload?.error || 'Failed to create customer')
                        await refreshClientsAndReselect(selected.id)
                      } catch (err) {
                        setBillingStripeError(err instanceof Error ? err.message : 'Stripe customer failed')
                      } finally {
                        setStripeAction(null)
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-white border border-brand-border text-xs font-semibold text-brand-text hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {stripeAction === 'customer' ? 'Working…' : selected.stripe_customer_id?.trim() ? 'Stripe customer linked' : 'Create / link Stripe customer'}
                  </button>

                  <div className="flex gap-2 items-center flex-wrap">
                    <select
                      value={checkoutTier}
                      onChange={e => setCheckoutTier(e.target.value)}
                      disabled={selected.is_potential || stripeAction !== null}
                      className="flex-1 min-w-[140px] py-2 px-2 rounded-lg bg-white border border-brand-border text-xs text-brand-text outline-none focus:border-accent disabled:opacity-50"
                    >
                      {Object.entries(tierLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={selected.is_potential || !selected.email?.trim() || stripeAction !== null}
                      title={selected.is_potential ? 'Activate billing first' : !selected.email?.trim() ? 'Client needs an email' : ''}
                      onClick={async () => {
                        setBillingStripeError('')
                        setStripeAction('checkout')
                        try {
                          const res = await fetch('/api/admin/stripe/checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clientId: selected.id, tier: checkoutTier }),
                          })
                          const payload = await res.json().catch(() => ({}))
                          if (!res.ok) throw new Error(payload?.error || 'Checkout failed')
                          if (payload.url) window.location.href = payload.url as string
                        } catch (err) {
                          setBillingStripeError(err instanceof Error ? err.message : 'Checkout failed')
                        } finally {
                          setStripeAction(null)
                        }
                      }}
                      className="py-2 px-3 rounded-lg bg-brand-text text-white text-xs font-bold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {stripeAction === 'checkout' ? '…' : 'Start subscription'}
                    </button>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={!selected.stripe_customer_id?.trim() || stripeAction !== null}
                      onClick={async () => {
                        setBillingStripeError('')
                        setStripeAction('portal')
                        try {
                          const res = await fetch('/api/admin/stripe/portal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clientId: selected.id }),
                          })
                          const payload = await res.json().catch(() => ({}))
                          if (!res.ok) throw new Error(payload?.error || 'Portal failed')
                          if (payload.url) window.open(payload.url as string, '_blank', 'noopener,noreferrer')
                        } catch (err) {
                          setBillingStripeError(err instanceof Error ? err.message : 'Portal failed')
                        } finally {
                          setStripeAction(null)
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-white border border-brand-border text-xs font-semibold text-brand-text hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {stripeAction === 'portal' ? '…' : 'Billing portal'}
                    </button>
                    <button
                      type="button"
                      disabled={!selected.stripe_subscription_id?.trim() || stripeAction !== null}
                      onClick={async () => {
                        setBillingStripeError('')
                        setStripeAction('sync')
                        try {
                          const res = await fetch('/api/admin/stripe/sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ clientId: selected.id }),
                          })
                          const payload = await res.json().catch(() => ({}))
                          if (!res.ok) throw new Error(payload?.error || 'Sync failed')
                          await refreshClientsAndReselect(selected.id)
                        } catch (err) {
                          setBillingStripeError(err instanceof Error ? err.message : 'Sync failed')
                        } finally {
                          setStripeAction(null)
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-white border border-brand-border text-xs font-semibold text-brand-text hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {stripeAction === 'sync' ? '…' : 'Refresh from Stripe'}
                    </button>
                  </div>

                  {selected.stripe_subscription_id?.trim() && (
                    <div className="flex gap-2 flex-wrap pt-1 border-t border-brand-border/60">
                      <button
                        type="button"
                        disabled={stripeAction !== null}
                        onClick={async () => {
                          if (!window.confirm('Cancel this subscription at the end of the current billing period?')) return
                          setBillingStripeError('')
                          setStripeAction('sub_cancel_end')
                          try {
                            const res = await fetch('/api/admin/stripe/subscription', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ clientId: selected.id, action: 'cancel_at_period_end' }),
                            })
                            const payload = await res.json().catch(() => ({}))
                            if (!res.ok) throw new Error(payload?.error || 'Update failed')
                            await refreshClientsAndReselect(selected.id)
                          } catch (err) {
                            setBillingStripeError(err instanceof Error ? err.message : 'Update failed')
                          } finally {
                            setStripeAction(null)
                          }
                        }}
                        className="flex-1 py-2 px-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {stripeAction === 'sub_cancel_end' ? '…' : 'Cancel at period end'}
                      </button>
                      <button
                        type="button"
                        disabled={stripeAction !== null}
                        onClick={async () => {
                          if (!window.confirm('Resume subscription (undo cancel at period end)?')) return
                          setBillingStripeError('')
                          setStripeAction('sub_resume')
                          try {
                            const res = await fetch('/api/admin/stripe/subscription', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ clientId: selected.id, action: 'resume' }),
                            })
                            const payload = await res.json().catch(() => ({}))
                            if (!res.ok) throw new Error(payload?.error || 'Update failed')
                            await refreshClientsAndReselect(selected.id)
                          } catch (err) {
                            setBillingStripeError(err instanceof Error ? err.message : 'Update failed')
                          } finally {
                            setStripeAction(null)
                          }
                        }}
                        className="flex-1 py-2 px-2 rounded-lg bg-green-50 border border-green-200 text-[10px] font-bold text-green-900 hover:bg-green-100 disabled:opacity-50"
                      >
                        {stripeAction === 'sub_resume' ? '…' : 'Resume subscription'}
                      </button>
                      <button
                        type="button"
                        disabled={stripeAction !== null}
                        onClick={async () => {
                          if (!window.confirm('Cancel this subscription immediately? This cannot be undone in the app.')) return
                          setBillingStripeError('')
                          setStripeAction('sub_cancel_now')
                          try {
                            const res = await fetch('/api/admin/stripe/subscription', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ clientId: selected.id, action: 'cancel_immediately' }),
                            })
                            const payload = await res.json().catch(() => ({}))
                            if (!res.ok) throw new Error(payload?.error || 'Cancel failed')
                            await refreshClientsAndReselect(selected.id)
                          } catch (err) {
                            setBillingStripeError(err instanceof Error ? err.message : 'Cancel failed')
                          } finally {
                            setStripeAction(null)
                          }
                        }}
                        className="flex-1 py-2 px-2 rounded-lg bg-red-50 border border-red-200 text-[10px] font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                      >
                        {stripeAction === 'sub_cancel_now' ? '…' : 'Cancel now'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Recent invoices (Stripe)</div>
                {!selected.stripe_customer_id?.trim() ? (
                  <p className="text-[11px] text-brand-dim">Link a Stripe customer to load invoices.</p>
                ) : invoicesLoading ? (
                  <p className="text-[11px] text-brand-dim">Loading invoices…</p>
                ) : adminInvoices.length === 0 ? (
                  <p className="text-[11px] text-brand-dim">No invoices yet for this customer.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-brand-border bg-white text-[11px]">
                    <div className="grid grid-cols-[1fr_72px_72px_auto] gap-1 px-2 py-1.5 border-b border-brand-border text-brand-dim font-bold uppercase tracking-wide">
                      <span>Invoice</span>
                      <span>Date</span>
                      <span className="text-right">Paid</span>
                      <span className="text-right"> </span>
                    </div>
                    {adminInvoices.map(inv => {
                      const cur = (inv.currency || 'usd').toUpperCase()
                      const amt = (inv.amount_paid / 100).toLocaleString(undefined, { style: 'currency', currency: cur })
                      const when = inv.created ? new Date(inv.created * 1000).toLocaleDateString() : '—'
                      return (
                        <div key={inv.id} className="grid grid-cols-[1fr_72px_72px_auto] gap-1 px-2 py-1.5 border-b border-gray-100 items-center text-brand-text">
                          <span className="truncate font-mono text-[10px]" title={inv.id}>{inv.number || inv.id}</span>
                          <span className="text-brand-muted">{when}</span>
                          <span className="text-right font-semibold">{amt}</span>
                          <span className="text-right">
                            {inv.hosted_invoice_url ? (
                              <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-accent font-semibold hover:underline">
                                View
                              </a>
                            ) : (
                              <span className="text-brand-dim">—</span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-1.5 flex-wrap mb-2">
                {(['trial', 'paid', 'past_due', 'unpaid'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBillingStatus(s)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                      selected.billing_status === s
                        ? 'bg-accent-soft text-accent border border-accent'
                        : 'bg-gray-50 text-brand-dim border border-brand-border hover:text-brand-text'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
                {selected.is_potential && (
                  <button
                    type="button"
                    onClick={activatePotentialClient}
                    className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-green-50 border border-green-200 text-brand-green hover:bg-green-100 transition-all"
                  >
                    Activate Billing
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowBillingAdvanced(v => !v)}
                className="text-[10px] font-bold uppercase text-accent mb-2 hover:underline"
              >
                {showBillingAdvanced ? 'Hide' : 'Show'} advanced (manual Stripe IDs)
              </button>
              {showBillingAdvanced && (
                <div className="grid grid-cols-1 gap-2 mb-2 p-2 rounded-lg border border-dashed border-brand-border bg-white/80">
                  <input
                    type="text"
                    key={`cus-${selected.id}-${selected.stripe_customer_id || ''}`}
                    defaultValue={selected.stripe_customer_id || ''}
                    onBlur={e => updateClient(selected.id, { stripe_customer_id: e.currentTarget.value.trim() })}
                    placeholder="Stripe customer ID (cus_...)"
                    className="w-full py-1.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-brand-text text-xs outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    key={`sub-${selected.id}-${selected.stripe_subscription_id || ''}`}
                    defaultValue={selected.stripe_subscription_id || ''}
                    onBlur={e => updateClient(selected.id, { stripe_subscription_id: e.currentTarget.value.trim() })}
                    placeholder="Stripe subscription ID (sub_...)"
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
