'use client'

import { useState, useEffect, useMemo, Suspense, type ReactNode } from 'react'
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
  date_of_birth?: string
  credit_goals: string[]
  funding_goals: string
  selected_credit_provider: string
  provider_username?: string
  provider_password?: string
  credit_profile?: Record<string, unknown>
  primary_credit_goals_text?: string
  funding_amount?: string
  funding_use?: string
  funding_timeframe?: string
  goals_notes?: string
  owns_business?: boolean
  business_name?: string
  business_profile?: Record<string, unknown>
  consent_data?: Record<string, boolean>
  typed_signature?: string
  signature_date?: string
  status: ApplicationStatus
  service_type?: string
  assigned_specialist?: string
  internal_notes?: string
  client_notes?: string
  next_steps?: string
  funding_scores?: FundingScores
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

function yesNo(value?: boolean | null) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return '—'
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  if (value == null || value === '') return null
  return (
    <div>
      <p className="text-xs font-semibold text-brand-dim uppercase mb-0.5">{label}</p>
      <p className="text-brand-text whitespace-pre-wrap break-words">{value}</p>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-brand-border">
      <h3 className="text-sm font-bold text-brand-text mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">{children}</div>
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState<'overview' | 'intake' | 'funding' | 'messages'>('overview')
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
  const [listPanelOpen, setListPanelOpen] = useState(true)

  const selectApplication = (id: string) => {
    loadDetail(id)
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setListPanelOpen(false)
    }
  }

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
    if (id) {
      loadDetail(id)
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
        setListPanelOpen(false)
      }
    }
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

      <div className={`grid grid-cols-1 gap-6 ${listPanelOpen ? 'lg:grid-cols-5' : 'lg:grid-cols-1'}`}>
        {listPanelOpen && (
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
                    onClick={() => selectApplication(app.id)}
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
                <button key={app.id} type="button" onClick={() => selectApplication(app.id)}
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
        )}

        <div className={`${listPanelOpen ? 'lg:col-span-3' : 'lg:col-span-1'} bg-white border border-brand-border rounded-xl p-6`}>
          {!listPanelOpen && (
            <button
              type="button"
              onClick={() => setListPanelOpen(true)}
              className="mb-4 inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Show applications list
            </button>
          )}
          {!selected ? (
            <p className="text-sm text-brand-dim">Select an application to view details.</p>
          ) : detailLoading ? (
            <p className="text-sm text-brand-dim">Loading details…</p>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  {listPanelOpen && (
                    <button
                      type="button"
                      onClick={() => setListPanelOpen(false)}
                      className="hidden lg:inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-brand-dim border border-brand-border rounded-lg hover:bg-neutral-50 transition-colors"
                      title="Hide applications list"
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M7 5L3 10L7 15M13 5L17 10L13 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Focus
                    </button>
                  )}
                  <div className="min-w-0">
                  <h2 className="text-xl font-bold text-brand-text">{selected.full_name}</h2>
                  <p className="text-sm text-brand-dim">{selected.application_id} · {selected.service_type?.replace(/_/g, ' ')}</p>
                  </div>
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

              <div className="flex gap-2 mb-5 border-b border-brand-border flex-wrap">
                {(['overview', 'intake', 'funding', 'messages'] as const).map((tab) => (
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
                      ['Date of Birth', selected.date_of_birth],
                      ['Address', `${selected.address}, ${selected.city}, ${selected.state} ${selected.zip_code}`],
                      ['Service Type', selected.service_type?.replace(/_/g, ' ')],
                      ['Funding Summary', selected.funding_goals],
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
                    onClick={() => patchApplication({ resend_portal_setup: true })}
                    className="mb-5 mr-3 px-4 py-2 border border-brand-border text-sm font-semibold rounded-lg hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Email Portal Setup Link
                  </button>

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

              {activeTab === 'intake' && (
                <div>
                  <DetailSection title="Personal Information">
                    <DetailField label="Full Name" value={selected.full_name} />
                    <DetailField label="Date of Birth" value={selected.date_of_birth} />
                    <DetailField label="Email" value={selected.email} />
                    <DetailField label="Phone" value={selected.phone} />
                    <DetailField label="Address" value={`${selected.address}, ${selected.city}, ${selected.state} ${selected.zip_code}`} />
                  </DetailSection>

                  <DetailSection title="Credit Profile">
                    <DetailField label="Credit Score" value={String(selected.credit_profile?.creditScore || '')} />
                    <DetailField label="Open Credit Cards" value={String(selected.credit_profile?.openCreditCards || '')} />
                    <DetailField label="Inquiries" value={String(selected.credit_profile?.inquiries || '')} />
                    <DetailField label="Monthly Gross Income" value={String(selected.credit_profile?.monthlyGrossIncome || '')} />
                    <DetailField label="Annual Income" value={String(selected.credit_profile?.annualIncome || '')} />
                    <DetailField label="Bankruptcy" value={yesNo(selected.credit_profile?.bankruptcy as boolean | undefined)} />
                    <DetailField label="Collections" value={yesNo(selected.credit_profile?.collections as boolean | undefined)} />
                    <DetailField label="Charge-offs" value={yesNo(selected.credit_profile?.chargeOffs as boolean | undefined)} />
                    <DetailField label="Late Payments (24 mo)" value={yesNo(selected.credit_profile?.latePayments24Months as boolean | undefined)} />
                    <DetailField label="Employed" value={yesNo(selected.credit_profile?.employed as boolean | undefined)} />
                    <DetailField label="Business Owner" value={yesNo(selected.credit_profile?.businessOwner as boolean | undefined)} />
                  </DetailSection>

                  <DetailSection title="Credit Monitoring Provider">
                    <DetailField label="Provider" value={selected.selected_credit_provider} />
                    <DetailField label="Username / Login" value={selected.provider_username} />
                    <DetailField label="Password" value={selected.provider_password} />
                  </DetailSection>

                  <DetailSection title="Goals & Funding">
                    <DetailField label="Primary Goals" value={selected.primary_credit_goals_text} />
                    <DetailField label="Selected Goals" value={(selected.credit_goals || []).join(', ')} />
                    <DetailField label="Funding Amount" value={selected.funding_amount} />
                    <DetailField label="Funding Use" value={selected.funding_use} />
                    <DetailField label="Timeframe" value={selected.funding_timeframe} />
                    <DetailField label="Owns Business" value={yesNo(selected.owns_business)} />
                    <DetailField label="Business Name" value={selected.business_name} />
                    <DetailField label="Additional Notes" value={selected.goals_notes} />
                  </DetailSection>

                  {(selected.business_profile && Object.keys(selected.business_profile).length > 0) && (
                    <DetailSection title="Business Information">
                      <DetailField label="Legal Name" value={String(selected.business_profile.legalName || '')} />
                      <DetailField label="DBA" value={String(selected.business_profile.dba || '')} />
                      <DetailField label="EIN" value={String(selected.business_profile.ein || '')} />
                      <DetailField label="Entity Type" value={String(selected.business_profile.entityType || '')} />
                      <DetailField label="Industry" value={String(selected.business_profile.industry || '')} />
                      <DetailField label="Year Established" value={String(selected.business_profile.yearEstablished || '')} />
                      <DetailField label="Employees" value={String(selected.business_profile.numberOfEmployees || '')} />
                      <DetailField label="Annual Revenue" value={String(selected.business_profile.annualRevenue || '')} />
                      <DetailField label="Business Address" value={[selected.business_profile.address, selected.business_profile.city, selected.business_profile.state, selected.business_profile.zipCode].filter(Boolean).join(', ')} />
                      <DetailField label="Business Phone" value={String(selected.business_profile.phone || '')} />
                      <DetailField label="Business Email" value={String(selected.business_profile.email || '')} />
                      <DetailField label="Website" value={String(selected.business_profile.website || '')} />
                      <DetailField label="Description" value={String(selected.business_profile.businessDescription || '')} />
                      <DetailField label="Funding Purposes" value={Array.isArray(selected.business_profile.fundingPurposes) ? (selected.business_profile.fundingPurposes as string[]).join(', ') : ''} />
                    </DetailSection>
                  )}

                  <DetailSection title="Consent & Signature">
                    <DetailField label="Accurate Information" value={yesNo(selected.consent_data?.accurateInfo)} />
                    <DetailField label="Authorize Review" value={yesNo(selected.consent_data?.authorizeReview)} />
                    <DetailField label="Agree to Terms" value={yesNo(selected.consent_data?.agreeTerms)} />
                    <DetailField label="Typed Signature" value={selected.typed_signature} />
                    <DetailField label="Signature Date" value={selected.signature_date} />
                  </DetailSection>
                </div>
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
