'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import CreditFundingStatusTracker from '@/components/credit-funding/CreditFundingStatusTracker'
import {
  APPLICATION_STATUSES,
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  STATUS_LABELS,
  type ApplicationStatus,
  type FundingScores,
} from '@/lib/credit-funding-types'

interface ApplicationListItem {
  id: string
  application_id: string
  full_name: string
  email: string
  phone: string
  service_type?: string
  status: string
  assigned_specialist?: string
  created_at: string
  updated_at: string
}

interface ApplicationDetail {
  id: string
  application_id: string
  full_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  credit_goals: string[]
  funding_goals: string
  selected_credit_provider: string
  status: ApplicationStatus
  service_type?: string
  assigned_specialist?: string
  internal_notes?: string
  client_notes?: string
  next_steps?: string
  funding_scores?: FundingScores
  business_profile?: Record<string, unknown>
  primary_credit_goals_text?: string
  funding_amount?: string
  funding_use?: string
  goals_notes?: string
  created_at: string
  updated_at: string
}

interface DocumentItem {
  id: string
  document_type: string
  file_name: string
  file_size: number
  scan_status: string
  signedUrl?: string
}

interface MessageItem {
  id: string
  from_role: string
  from_name: string
  text: string
  created_at: string
}

interface DocRequest {
  id: string
  document_type: string
  label: string
  status: string
  notes?: string
}

const DOC_LABELS_MAP: Record<string, string> = { ...DOCUMENT_LABELS }

function CreditFundingAdminContent() {
  const searchParams = useSearchParams()
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [selected, setSelected] = useState<ApplicationDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [history, setHistory] = useState<{ status: ApplicationStatus; created_at: string; notes?: string; staff_email?: string }[]>([])
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [docRequests, setDocRequests] = useState<DocRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'funding' | 'messages'>('overview')
  const [newMsg, setNewMsg] = useState('')
  const [editFields, setEditFields] = useState({
    assigned_specialist: '',
    internal_notes: '',
    client_notes: '',
    next_steps: '',
    status_notes: '',
  })
  const [fundingScores, setFundingScores] = useState<FundingScores>({})
  const [docReqType, setDocReqType] = useState('')
  const [docReqLabel, setDocReqLabel] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.set('status', statusFilter)
        const r = await fetch(`/api/admin/credit-funding?${params}`)
        if (!r.ok) throw new Error('Failed to load')
        setApplications(await r.json())
        setError('')
      } catch {
        setError('Failed to load applications')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [statusFilter])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) loadDetail(id)
  }, [searchParams])

  const loadDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const r = await fetch(`/api/admin/credit-funding?id=${id}&includeDocs=true`)
      if (!r.ok) throw new Error('Failed to load detail')
      const data = await r.json()
      const app = data.application as ApplicationDetail
      setSelected(app)
      setDocuments(data.documents || [])
      setHistory(data.history || [])
      setMessages(data.messages || [])
      setDocRequests(data.docRequests || [])
      setEditFields({
        assigned_specialist: app.assigned_specialist || '',
        internal_notes: app.internal_notes || '',
        client_notes: app.client_notes || '',
        next_steps: app.next_steps || '',
        status_notes: '',
      })
      setFundingScores(app.funding_scores || {})
    } catch {
      setError('Failed to load application details')
    } finally {
      setDetailLoading(false)
    }
  }

  const patchApplication = async (body: Record<string, unknown>) => {
    if (!selected) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/credit-funding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, ...body }),
      })
      if (!r.ok) throw new Error('Update failed')
      const updated = await r.json()
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev))
      setApplications((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, ...updated, status: updated.status } : a))
      )
      await loadDetail(selected.id)
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !newMsg.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/credit-funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: selected.id, text: newMsg.trim() }),
      })
      if (!r.ok) throw new Error('Send failed')
      setNewMsg('')
      await loadDetail(selected.id)
    } catch {
      setError('Failed to send message')
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search.trim()) params.set('search', search.trim())
    window.open(`/api/admin/credit-funding/export?${params}`, '_blank')
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return applications
    const q = search.toLowerCase()
    return applications.filter(
      (a) =>
        a.full_name.toLowerCase().includes(q) ||
        a.application_id.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.assigned_specialist || '').toLowerCase().includes(q)
    )
  }, [applications, search])

  const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Credit &amp; Funding Applications</h1>
          <p className="text-sm text-brand-muted mt-1">Manage intake submissions, funding scores, and applicant messaging</p>
        </div>
        <button onClick={exportCsv} className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50">
          Export CSV
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white border border-brand-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-brand-border space-y-3">
            <input className={inputClass} placeholder="Search name, email, ID, specialist…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs hidden sm:table">
              <thead className="bg-neutral-50 border-b border-brand-border">
                <tr>
                  {['ID', 'Name', 'Status', 'Specialist', 'Updated'].map((h) => (
                    <th key={h} className="text-left p-2 font-semibold text-brand-dim">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => loadDetail(app.id)}
                    className={`border-b border-brand-border cursor-pointer hover:bg-neutral-50 ${selected?.id === app.id ? 'bg-accent-soft/40' : ''}`}
                  >
                    <td className="p-2 font-mono">{app.application_id}</td>
                    <td className="p-2">{app.full_name}</td>
                    <td className="p-2"><StatusBadge status={app.status} /></td>
                    <td className="p-2 text-brand-dim">{app.assigned_specialist || '—'}</td>
                    <td className="p-2 text-brand-dim">{new Date(app.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="max-h-[400px] overflow-y-auto sm:hidden">
            {loading ? (
              <p className="p-6 text-sm text-brand-dim">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-sm text-brand-dim">No applications found.</p>
            ) : (
              filtered.map((app) => (
                <button key={app.id} type="button" onClick={() => loadDetail(app.id)}
                  className={`w-full text-left p-4 border-b border-brand-border hover:bg-neutral-50 ${selected?.id === app.id ? 'bg-accent-soft/40' : ''}`}>
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold text-sm">{app.full_name}</p>
                    <StatusBadge status={app.status} />
                  </div>
                  <p className="text-xs text-brand-dim mt-1">{app.application_id}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-brand-border rounded-xl p-6">
          {!selected ? (
            <p className="text-sm text-brand-dim">Select an application to view details.</p>
          ) : detailLoading ? (
            <p className="text-sm text-brand-dim">Loading details…</p>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-brand-text">{selected.full_name}</h2>
                  <p className="text-sm text-brand-dim">{selected.application_id} · {selected.service_type?.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className={inputClass}
                    value={selected.status}
                    disabled={saving}
                    onChange={(e) => patchApplication({ status: e.target.value, status_notes: editFields.status_notes })}
                  >
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mb-5 border-b border-brand-border">
                {(['overview', 'funding', 'messages'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 text-xs font-semibold capitalize border-b-2 -mb-px transition-colors ${
                      activeTab === tab ? 'border-accent text-brand-text' : 'border-transparent text-brand-dim'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-sm">
                    {[
                      ['Email', selected.email],
                      ['Phone', selected.phone],
                      ['Address', `${selected.address}, ${selected.city}, ${selected.state} ${selected.zip_code}`],
                      ['Provider', selected.selected_credit_provider],
                      ['Funding', selected.funding_goals],
                      ['Submitted', new Date(selected.created_at).toLocaleString()],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs font-semibold text-brand-dim uppercase mb-0.5">{label}</p>
                        <p className="text-brand-text">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-5">
                    <CreditFundingStatusTracker currentStatus={selected.status} history={history} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    <div>
                      <label className="text-xs font-semibold text-brand-dim">Assigned Specialist</label>
                      <input className={inputClass} value={editFields.assigned_specialist}
                        onChange={(e) => setEditFields((f) => ({ ...f, assigned_specialist: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-brand-dim">Status Change Notes</label>
                      <input className={inputClass} placeholder="Optional note for applicant email"
                        value={editFields.status_notes}
                        onChange={(e) => setEditFields((f) => ({ ...f, status_notes: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-brand-dim">Internal Notes (staff only)</label>
                      <textarea className={`${inputClass} min-h-[80px]`} value={editFields.internal_notes}
                        onChange={(e) => setEditFields((f) => ({ ...f, internal_notes: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-brand-dim">Client-Facing Notes</label>
                      <textarea className={`${inputClass} min-h-[60px]`} value={editFields.client_notes}
                        onChange={(e) => setEditFields((f) => ({ ...f, client_notes: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-brand-dim">Next Steps</label>
                      <textarea className={`${inputClass} min-h-[60px]`} value={editFields.next_steps}
                        onChange={(e) => setEditFields((f) => ({ ...f, next_steps: e.target.value }))} />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => patchApplication({
                      assigned_specialist: editFields.assigned_specialist,
                      internal_notes: editFields.internal_notes,
                      client_notes: editFields.client_notes,
                      next_steps: editFields.next_steps,
                    })}
                    className="mb-5 px-4 py-2 bg-brand-text text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    Save Notes &amp; Assignment
                  </button>

                  <div className="mb-5 p-4 bg-neutral-50 rounded-lg border border-brand-border">
                    <h4 className="text-sm font-bold mb-2">Request Document</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <select className={inputClass} value={docReqType} onChange={(e) => {
                        setDocReqType(e.target.value)
                        setDocReqLabel(DOC_LABELS_MAP[e.target.value] || e.target.value)
                      }}>
                        <option value="">Select document type</option>
                        {DOCUMENT_TYPES.map((t) => (
                          <option key={t} value={t}>{DOC_LABELS_MAP[t]}</option>
                        ))}
                      </select>
                      <input className={inputClass} placeholder="Label" value={docReqLabel} onChange={(e) => setDocReqLabel(e.target.value)} />
                    </div>
                    <button
                      type="button"
                      disabled={!docReqType || !docReqLabel || saving}
                      onClick={() => {
                        patchApplication({ document_request: { document_type: docReqType, label: docReqLabel } })
                        setDocReqType('')
                        setDocReqLabel('')
                      }}
                      className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                    >
                      Send document request
                    </button>
                    {docRequests.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs text-brand-muted">
                        {docRequests.map((d) => (
                          <li key={d.id}>{d.label} — {d.status}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <h3 className="text-sm font-bold mb-2">Uploaded Documents</h3>
                  {documents.length === 0 ? (
                    <p className="text-sm text-brand-dim">No documents.</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex justify-between p-3 bg-neutral-50 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{DOC_LABELS_MAP[doc.document_type] || doc.document_type}</p>
                            <p className="text-xs text-brand-dim">{doc.file_name}</p>
                          </div>
                          {doc.signedUrl && (
                            <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent">View</a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'funding' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {(['revenue_score', 'funding_readiness', 'credit_readiness'] as const).map((key) => (
                      <div key={key}>
                        <label className="text-xs font-semibold text-brand-dim capitalize">{key.replace(/_/g, ' ')}</label>
                        <input type="number" min="0" max="100" className={inputClass}
                          value={fundingScores[key] ?? ''}
                          onChange={(e) => setFundingScores((s) => ({ ...s, [key]: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-brand-dim">Estimated Funding Range</label>
                    <input className={inputClass} placeholder="e.g. $50,000 – $150,000"
                      value={fundingScores.estimated_range || ''}
                      onChange={(e) => setFundingScores((s) => ({ ...s, estimated_range: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-brand-dim">Recommended Programs (comma-separated)</label>
                    <input className={inputClass}
                      value={(fundingScores.recommended_programs || []).join(', ')}
                      onChange={(e) => setFundingScores((s) => ({
                        ...s,
                        recommended_programs: e.target.value.split(',').map((p) => p.trim()).filter(Boolean),
                      }))} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-brand-dim">Specialist Recommendations</label>
                    <textarea className={`${inputClass} min-h-[100px]`}
                      value={fundingScores.specialist_notes || ''}
                      onChange={(e) => setFundingScores((s) => ({ ...s, specialist_notes: e.target.value }))} />
                  </div>
                  <button type="button" disabled={saving}
                    onClick={() => patchApplication({ funding_scores: fundingScores })}
                    className="px-4 py-2 bg-brand-text text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                    Save Funding Scores
                  </button>
                </div>
              )}

              {activeTab === 'messages' && (
                <div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4">
                    {messages.length === 0 ? (
                      <p className="text-sm text-brand-dim">No messages yet.</p>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className={`p-3 rounded-lg text-sm ${m.from_role === 'admin' ? 'bg-accent-soft/40' : 'bg-neutral-50'}`}>
                          <p className="text-xs text-brand-dim">{m.from_name} · {new Date(m.created_at).toLocaleString()}</p>
                          <p className="text-brand-muted whitespace-pre-wrap">{m.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <input className={`flex-1 ${inputClass}`} placeholder="Reply to applicant…" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} />
                    <button type="submit" disabled={saving || !newMsg.trim()} className="px-4 py-2 bg-brand-text text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CreditFundingAdminPage() {
  return (
    <Suspense fallback={<p className="text-sm text-brand-dim">Loading…</p>}>
      <CreditFundingAdminContent />
    </Suspense>
  )
}
