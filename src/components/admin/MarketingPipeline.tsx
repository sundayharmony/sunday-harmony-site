'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CATEGORY_LABELS,
  FIELD_PURPOSES,
  LEAD_SOURCES,
  PROSPECT_CATEGORIES,
  SOURCE_LABELS,
  STAGE_LABELS,
  type LeadSource,
  type PipelineStage,
} from '@/lib/marketing-pipeline'

type ProspectCard = {
  id: string
  business: string
  contactName: string
  stage: PipelineStage
  score: number | null
  followUpAt: string | null
  source: string
}

const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm'

function formatWhen(iso: string | null): string {
  if (!iso) return 'No follow-up'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No follow-up'
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StageGroup({ stage, rows }: { stage: PipelineStage; rows: ProspectCard[] }) {
  return (
    <section className="bg-white border border-brand-border rounded-xl p-3 min-w-0">
      <h2 className="text-xs font-bold uppercase tracking-wide text-brand-dim mb-2">
        {STAGE_LABELS[stage]} <span className="text-brand-muted">({rows.length})</span>
      </h2>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-brand-muted">None in this stage.</p>}
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/admin/pipeline/${row.id}`}
            className="block rounded-lg border border-brand-border px-3 py-2 hover:border-accent"
          >
            <div className="text-sm font-semibold text-brand-text">{row.business}</div>
            <div className="text-xs text-brand-muted">
              {row.contactName || 'No contact'} · {formatWhen(row.followUpAt)}
              {row.score != null ? ` · ${row.score}/10` : ''}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default function MarketingPipeline() {
  const [prospects, setProspects] = useState<ProspectCard[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    business: '',
    contactName: '',
    email: '',
    phone: '',
    industry: '',
    website: '',
    location: '',
    category: '',
    opportunity: '',
    recommendedService: '',
    source: 'outbound',
    followUpAt: '',
    stage: 'researching',
    estimatedValue: '',
    notes: '',
  })

  async function load() {
    const res = await fetch('/api/admin/pipeline')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Could not load the pipeline.')
      return
    }
    setProspects(data.prospects || [])
    setStages(data.stages || [])
  }

  useEffect(() => {
    void load()
  }, [])

  const grouped = useMemo(() => {
    return stages.map((stage) => ({
      stage,
      rows: prospects.filter((row) => row.stage === stage),
    }))
  }, [prospects, stages])

  async function createProspect(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          followUpAt: form.followUpAt ? new Date(form.followUpAt).toISOString() : '',
          estimatedValue: form.estimatedValue,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not add the prospect')
      setOpen(false)
      setNotice(data.warning || 'Prospect added.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the prospect')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Pipeline</h1>
          <p className="text-sm text-brand-muted">Marketing prospects, from research through a signed agreement.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg"
        >
          {open ? 'Close' : 'Add prospect'}
        </button>
      </div>
      {error && <p className="text-sm text-brand-red mb-3">{error}</p>}
      {notice && <p className="text-sm text-brand-muted mb-3">{notice}</p>}

      {open && (
        <form onSubmit={createProspect} className="bg-white border border-brand-border rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="font-medium">Business name</span>
            <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.business}</span>
            <input className={inputClass} required value={form.business} onChange={(event) => setForm({ ...form, business: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Contact person</span>
            <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.contact}</span>
            <input className={inputClass} value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Email</span>
            <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.email}</span>
            <input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Phone</span>
            <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.phone}</span>
            <input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Follow-up</span>
            <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.followUp}</span>
            <input type="datetime-local" required className={inputClass} value={form.followUpAt} onChange={(event) => setForm({ ...form, followUpAt: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Lead source</span>
            <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.source}</span>
            <select className={inputClass} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
              {LEAD_SOURCES.filter((source) => source !== 'inbound').map((source) => (
                <option key={source} value={source}>{SOURCE_LABELS[source as LeadSource]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Category</span>
            <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.category}</span>
            <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="">Not set</option>
              {PROSPECT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Marketing opportunity</span>
            <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.opportunity}</span>
            <textarea className={inputClass} rows={2} value={form.opportunity} onChange={(event) => setForm({ ...form, opportunity: event.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg disabled:opacity-60">
              {saving ? 'Saving…' : 'Save prospect'}
            </button>
          </div>
        </form>
      )}

      <div className="hidden md:grid md:grid-cols-3 xl:grid-cols-4 gap-3">
        {grouped.map((group) => (
          <StageGroup key={group.stage} stage={group.stage} rows={group.rows} />
        ))}
      </div>
      <div className="md:hidden space-y-3">
        {grouped.map((group) => (
          <StageGroup key={group.stage} stage={group.stage} rows={group.rows} />
        ))}
      </div>
    </div>
  )
}
