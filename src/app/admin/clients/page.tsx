'use client'

import { useState, useEffect } from 'react'
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
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', industry: '', packageTier: 'spark', loginPassword: '' })

  useEffect(() => {
    fetch('/api/admin/clients').then(r => r.json()).then(setClients)
  }, [])

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

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    const updated = await res.json()
    setClients(prev => prev.map(c => c.id === id ? updated : c))
  }

  const active = clients.filter(c => c.status === 'active')
  const mrr = active.reduce((s, c) => s + c.monthly_price, 0)

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Clients</h1>
          <p className="text-sm text-brand-muted">{active.length} active &bull; ${mrr.toLocaleString()}/mo MRR</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 rounded-lg bg-gradient-to-br from-brand-gold to-[#b8944f] text-[#0a0a0f] text-sm font-bold hover:-translate-y-0.5 transition-all"
        >
          + Add Client
        </button>
      </div>

      {/* New Client Form */}
      {showForm && (
        <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.15)] rounded-xl p-6 mb-6">
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
                  className="w-full py-2 px-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg text-brand-text text-sm outline-none focus:border-[rgba(201,169,110,0.3)]"
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
                      ? 'bg-[rgba(201,169,110,0.15)] text-brand-gold border border-[rgba(201,169,110,0.3)]'
                      : 'bg-[rgba(255,255,255,0.03)] text-brand-dim border border-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  {label} (${tierPrices[key]})
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addClient} className="px-4 py-2 rounded-lg bg-brand-gold text-[#0a0a0f] text-xs font-bold">
              Create Client
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-brand-dim text-xs hover:text-brand-text">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Client List */}
      <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
        {clients.length === 0 ? (
          <div className="p-8 text-center text-brand-dim text-sm">
            No clients yet. Add your first client above or convert a lead from the Leads page.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                {['Client', 'Business', 'Package', 'Monthly', 'Status', 'Since', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="px-4 py-3 text-sm font-medium text-brand-text">{client.name}</td>
                  <td className="px-4 py-3 text-sm text-brand-muted">{client.business}</td>
                  <td className="px-4 py-3 text-xs text-brand-gold font-semibold">{tierLabels[client.package_tier]}</td>
                  <td className="px-4 py-3 text-sm text-brand-text">${client.monthlyPrice.toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={client.status} /></td>
                  <td className="px-4 py-3 text-xs text-brand-dim">{new Date(client.startDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={client.status}
                      onChange={e => updateStatus(client.id, e.target.value)}
                      className="bg-transparent border border-[rgba(255,255,255,0.06)] rounded px-2 py-1 text-xs text-brand-muted outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="churned">Churned</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
