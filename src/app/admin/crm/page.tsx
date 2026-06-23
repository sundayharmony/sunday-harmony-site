'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import { LEAD_TYPE_LABELS, type LeadType } from '@/lib/crm-types'
import type { CrmContactRow, CrmDashboardStats } from '@/lib/crm-db'

const LEAD_TYPE_FILTERS = ['all', 'marketing_lead', 'credit_repair_lead', 'personal_funding_lead', 'business_funding_lead', 'credit_repair_funding', 'existing_client', 'completed_client']

export default function CrmOverviewPage() {
  const [contacts, setContacts] = useState<CrmContactRow[]>([])
  const [stats, setStats] = useState<CrmDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [leadType, setLeadType] = useState('all')
  const [appStatus, setAppStatus] = useState('all')
  const [assigned, setAssigned] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [creditRepair, setCreditRepair] = useState(false)
  const [businessOwner, setBusinessOwner] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (leadType !== 'all') params.set('lead_type', leadType)
      if (appStatus !== 'all') params.set('application_status', appStatus)
      if (assigned !== 'all') params.set('assigned_team_member', assigned)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      if (creditRepair) params.set('credit_repair', 'true')
      if (businessOwner) params.set('business_owner', 'true')
      if (search.trim()) params.set('search', search.trim())

      const r = await fetch(`/api/admin/crm?${params}`)
      const d = await r.json()
      setContacts(d.contacts || [])
      setStats(d.stats || null)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadType, appStatus, assigned, dateFrom, dateTo, creditRepair, businessOwner])

  const assignees = useMemo(() => {
    const set = new Set<string>()
    contacts.forEach((c) => c.assigned_team_member && set.add(c.assigned_team_member))
    return Array.from(set).sort()
  }, [contacts])

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts
    const q = search.toLowerCase()
    return contacts.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.business || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    )
  }, [contacts, search])

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">CRM Overview</h1>
          <p className="text-sm text-brand-muted">Unified contact management across marketing, credit repair, and funding.</p>
        </div>
        <Link
          href="/admin/reports/crm"
          className="px-4 py-2 rounded-lg bg-gray-50 border border-brand-border text-brand-muted text-xs font-semibold hover:text-brand-text"
        >
          CRM Reports →
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard label="Marketing Leads" value={stats.marketing_leads} />
          <StatCard label="Credit Repair" value={stats.credit_repair_clients} color="accent" />
          <StatCard label="Funding Clients" value={stats.funding_clients} />
          <StatCard label="Business Funding" value={stats.business_funding_clients} />
          <StatCard label="Pending Apps" value={stats.pending_applications} />
          <StatCard label="Active Clients" value={stats.active_clients} />
          <StatCard label="Completed" value={stats.completed_clients} />
        </div>
      )}

      <div className="bg-white border border-brand-border rounded-xl p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent md:col-span-2"
          />
          <select value={leadType} onChange={(e) => setLeadType(e.target.value)}
            className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm">
            <option value="all">All Lead Types</option>
            {LEAD_TYPE_FILTERS.filter((t) => t !== 'all').map((t) => (
              <option key={t} value={t}>{LEAD_TYPE_LABELS[t as LeadType] || t}</option>
            ))}
          </select>
          <select value={appStatus} onChange={(e) => setAppStatus(e.target.value)}
            className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm">
            <option value="all">All App Statuses</option>
            {['submitted', 'documents_pending', 'under_review', 'credit_analysis_complete', 'funding_review', 'approved', 'completed'].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={assigned} onChange={(e) => setAssigned(e.target.value)}
            className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm">
            <option value="all">All Team Members</option>
            {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm" title="To date" />
        </div>
        <div className="flex gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-brand-muted">
            <input type="checkbox" checked={creditRepair} onChange={(e) => setCreditRepair(e.target.checked)} />
            Credit Repair only
          </label>
          <label className="flex items-center gap-2 text-xs text-brand-muted">
            <input type="checkbox" checked={businessOwner} onChange={(e) => setBusinessOwner(e.target.checked)} />
            Business owners
          </label>
          <button onClick={() => void load()} className="px-3 py-1.5 rounded-lg bg-brand-text text-white text-xs font-bold">
            Apply Filters
          </button>
        </div>
      </div>

      <div className="bg-white border border-brand-border rounded-xl overflow-x-auto shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-brand-dim text-sm">Loading contacts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-brand-dim text-sm">No contacts match your filters.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border">
                {['Name', 'Business', 'Lead Type', 'Status', 'Assigned', 'Created'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.1em] uppercase text-brand-dim">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={`${c.entity_type}-${c.id}`} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/contacts/${c.entity_type}/${c.id}`}
                      className="text-sm font-medium text-accent hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-muted">{c.business}</td>
                  <td className="px-4 py-3 text-xs">{LEAD_TYPE_LABELS[c.lead_type as LeadType] || c.lead_type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.credit_funding_client_status || c.marketing_lead_status || c.application_status || 'new'} />
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-dim">{c.assigned_team_member || '—'}</td>
                  <td className="px-4 py-3 text-xs text-brand-dim">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
