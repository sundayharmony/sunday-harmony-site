'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import { APPLICATION_STATUSES } from '@/lib/credit-funding-types'

interface ApplicationListItem {
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
  status: string
  created_at: string
  updated_at: string
}

interface DocumentItem {
  id: string
  document_type: string
  file_name: string
  file_type: string
  file_size: number
  scan_status: string
  signedUrl?: string
  created_at: string
}

interface ApplicationDetail extends ApplicationListItem {
  primary_credit_goals_text?: string
  funding_amount?: string
  funding_use?: string
  goals_notes?: string
  typed_signature?: string
  signature_date?: string
  credit_profile?: Record<string, unknown>
}

const DOC_LABELS: Record<string, string> = {
  photo_id: 'Government Photo ID',
  proof_of_address: 'Proof of Address',
  selfie_with_id: 'Selfie with ID',
  mail_proof: 'Mail Proof',
}

function CreditFundingAdminContent() {
  const searchParams = useSearchParams()
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [selected, setSelected] = useState<ApplicationDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

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
      setSelected(data.application)
      setDocuments(data.documents || [])
    } catch {
      setError('Failed to load application details')
    } finally {
      setDetailLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    setSavingStatus(true)
    try {
      const r = await fetch('/api/admin/credit-funding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!r.ok) throw new Error('Update failed')
      const updated = await r.json()
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: updated.status } : a)))
      if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, status: updated.status } : prev))
    } catch {
      setError('Failed to update status')
    } finally {
      setSavingStatus(false)
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
        a.email.toLowerCase().includes(q)
    )
  }, [applications, search])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Credit &amp; Funding</h1>
          <p className="text-sm text-brand-muted mt-1">Review intake submissions and uploaded documents</p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List panel */}
        <div className="lg:col-span-2 bg-white border border-brand-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-brand-border space-y-3">
            <input
              className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
              placeholder="Search by name, email, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <p className="p-6 text-sm text-brand-dim">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-sm text-brand-dim">No applications found.</p>
            ) : (
              filtered.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => loadDetail(app.id)}
                  className={`w-full text-left p-4 border-b border-brand-border hover:bg-neutral-50 transition-colors ${
                    selected?.id === app.id ? 'bg-accent-soft/40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-brand-text">{app.full_name}</p>
                      <p className="text-xs text-brand-dim mt-0.5">{app.application_id}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                  <p className="text-xs text-brand-muted mt-2">{app.email}</p>
                  <p className="text-xs text-brand-dim mt-1">{new Date(app.created_at).toLocaleDateString()}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3 bg-white border border-brand-border rounded-xl p-6">
          {!selected ? (
            <p className="text-sm text-brand-dim">Select an application to view details.</p>
          ) : detailLoading ? (
            <p className="text-sm text-brand-dim">Loading details…</p>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-brand-text">{selected.full_name}</h2>
                  <p className="text-sm text-brand-dim">{selected.application_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm"
                    value={selected.status}
                    disabled={savingStatus}
                    onChange={(e) => updateStatus(selected.id, e.target.value)}
                  >
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                {[
                  ['Email', selected.email],
                  ['Phone', selected.phone],
                  ['Address', `${selected.address}, ${selected.city}, ${selected.state} ${selected.zip_code}`],
                  ['Provider', selected.selected_credit_provider],
                  ['Funding Goals', selected.funding_goals],
                  ['Credit Goals', (selected.credit_goals || []).join(', ') || '—'],
                  ['Submitted', new Date(selected.created_at).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-brand-text">{value}</p>
                  </div>
                ))}
              </div>

              {selected.goals_notes && (
                <div className="mb-6 p-4 bg-neutral-50 rounded-lg border border-brand-border">
                  <p className="text-xs font-semibold text-brand-dim uppercase mb-1">Notes</p>
                  <p className="text-sm text-brand-muted whitespace-pre-wrap">{selected.goals_notes}</p>
                </div>
              )}

              <h3 className="text-sm font-bold text-brand-text mb-3">Uploaded Documents</h3>
              {documents.length === 0 ? (
                <p className="text-sm text-brand-dim">No documents on file.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-brand-border">
                      <div>
                        <p className="text-sm font-medium text-brand-text">{DOC_LABELS[doc.document_type] || doc.document_type}</p>
                        <p className="text-xs text-brand-dim">{doc.file_name} · {(doc.file_size / 1024).toFixed(0)} KB · {doc.scan_status}</p>
                      </div>
                      {doc.signedUrl && (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-accent hover:underline"
                        >
                          View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-brand-dim mt-6 italic">
                Sensitive credentials are encrypted at rest and masked in this view.
              </p>
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
