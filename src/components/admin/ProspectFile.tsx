'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import CloserBilling from '@/components/admin/CloserBilling'
import MeetingJoinList from '@/components/admin/MeetingJoinList'
import type { JoinableMeeting } from '@/lib/joinable-meetings'
import { packages } from '@/lib/data'
import {
  CATEGORY_LABELS,
  FIELD_PURPOSES,
  LEAD_SOURCES,
  PIPELINE_STAGES,
  PROSPECT_CATEGORIES,
  SCORE_FACTORS,
  SOURCE_LABELS,
  STAGE_LABELS,
  canHandOffToRelations,
  canHandOffToSales,
  canMoveStage,
  isLeadSource,
  isProspectCategory,
  roleMayRunSalesActions,
  scoreBandLabel,
  scoreTotal,
  type PipelineStage,
  type ScoreFactors,
} from '@/lib/marketing-pipeline'

type Prospect = {
  id: string
  business: string
  contactName: string
  email: string
  phone: string
  industry: string
  website: string
  location: string
  category: string
  opportunity: string
  recommendedService: string
  scoreFactors: ScoreFactors
  source: string
  lastContactedAt: string | null
  followUpAt: string | null
  stage: PipelineStage
  estimatedValue: number | null
  notes: string
  gmailThreadId: string | null
  driveFolderUrl: string | null
  proposalDocUrl: string | null
  agreementSignedAt: string | null
  paymentStatus: string
  servicesPurchased: string
  scope: string
  deliverables: string
  deadline: string
  promises: string
  expectations: string
  creditApplicationId: string | null
  closeMethod: string | null
}

type Script = { id: string; label: string; channel: 'email' | 'copy'; subject: string; body: string }
type ThreadMessage = { from: string; date: string; snippet: string }

const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm'
const headerButtonClass =
  'inline-flex w-full sm:w-auto items-center justify-center px-4 py-2.5 rounded-xl border border-brand-border bg-white text-sm font-semibold text-brand-text hover:border-accent hover:text-accent transition-colors'

function formatWhen(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatMoney(value: number | null): string {
  if (value == null || Number.isNaN(value)) return ''
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function websiteHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function sourceLabel(source: string): string {
  const key = source === 'inbound' ? 'website' : source
  return isLeadSource(key) ? SOURCE_LABELS[key] : source
}

function Fact({
  label,
  children,
  wide,
}: {
  label: string
  children?: ReactNode
  wide?: boolean
}) {
  const empty = children == null || children === ''
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className={`mt-1 text-sm break-words whitespace-pre-wrap ${empty ? 'text-brand-muted' : 'text-brand-text'}`}>
        {empty ? 'Not set' : children}
      </dd>
    </div>
  )
}

function localInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function packageDefaults(tier: string): { price: number; priceType: 'one-time' | 'monthly' | 'custom' } {
  const pkg = packages.find((row) => row.tier === tier)
  if (!pkg) return { price: 0, priceType: 'custom' }
  const price = pkg.price != null ? pkg.price : Number((pkg.priceLabel || '').replace(/[^0-9.]/g, '')) || 0
  const priceType =
    pkg.priceSuffix === 'monthly' ? 'monthly' : pkg.priceSuffix === 'one-time' ? 'one-time' : 'custom'
  return { price, priceType }
}

export default function ProspectFile({ id }: { id: string }) {
  const [prospect, setProspect] = useState<Prospect | null>(null)
  const [scripts, setScripts] = useState<Script[]>([])
  const [workspaceConnected, setWorkspaceConnected] = useState(false)
  const [scriptId, setScriptId] = useState('established')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [meetingAt, setMeetingAt] = useState('')
  const [meetingDuration, setMeetingDuration] = useState(30)
  const [meetingNotes, setMeetingNotes] = useState('')
  const [agreementTier, setAgreementTier] = useState('')
  const [agreementPrice, setAgreementPrice] = useState('')
  const [agreementPriceType, setAgreementPriceType] = useState<'one-time' | 'monthly' | 'custom'>('one-time')
  const [meetings, setMeetings] = useState<JoinableMeeting[]>([])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Prospect | null>(null)

  function applyProspect(next: Prospect, nextScripts?: Script[]) {
    setProspect(next)
    if (nextScripts) {
      setScripts(nextScripts)
      const first = nextScripts.find((script) => script.channel === 'email') || nextScripts[0]
      if (first) {
        setScriptId(first.id)
        setSubject(first.subject)
        setBody(first.body)
      }
    }
    if (!agreementTier) {
      const tier =
        packages.find((pkg) => pkg.tier === next.servicesPurchased)?.tier
        || packages.find((pkg) => pkg.tier === next.recommendedService)?.tier
        || packages[0]?.tier
        || ''
      if (tier) {
        setAgreementTier(tier)
        const defaults = packageDefaults(tier)
        setAgreementPrice(String(defaults.price || ''))
        setAgreementPriceType(defaults.priceType)
      }
    }
  }

  useEffect(() => {
    void fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => setRole(typeof data?.user?.role === 'string' ? data.user.role : null))
      .catch(() => setRole(null))
  }, [])

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/admin/pipeline/${id}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not open this prospect.')
        return
      }
      applyProspect(data.prospect, data.scripts)
      setMeetings(Array.isArray(data.meetings) ? data.meetings : [])
      setWorkspaceConnected(Boolean(data.workspaceConnected))
    })()
  }, [id])

  if (error && !prospect) return <p className="text-sm text-brand-red">{error}</p>
  if (!prospect) return <p className="text-sm text-brand-muted">Loading prospect…</p>

  const total = scoreTotal(prospect.scoreFactors)
  const selectedScript = scripts.find((script) => script.id === scriptId)
  const isSales = roleMayRunSalesActions(role)
  const isProcurement = role === 'lead_procurement'
  const showOutreach = role === 'admin' || isProcurement
  const showClose = role === 'admin' || isSales
  const showScore = role === 'admin' || isProcurement

  function patch(partial: Partial<Prospect>) {
    setProspect((current) => (current ? { ...current, ...partial } : current))
  }

  function startEdit() {
    if (!prospect) return
    setDraft(prospect)
    setEditing(true)
    setNotice('')
  }

  function cancelEdit() {
    if (draft) setProspect(draft)
    setDraft(null)
    setEditing(false)
    setError('')
    setNotice('')
  }

  async function save(nextProspect?: Prospect, options?: { keepEditing?: boolean }) {
    const current = nextProspect || prospect
    if (!current) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/admin/pipeline/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...current,
          followUpAt: current.followUpAt ? new Date(current.followUpAt).toISOString() : '',
          agreementSigned: Boolean(current.agreementSignedAt),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save')
      applyProspect(data.prospect)
      if (!options?.keepEditing) {
        setEditing(false)
        setDraft(null)
      }
      setNotice(data.warning || 'Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  function changeStage(stage: PipelineStage) {
    if (!prospect) return
    const next = { ...prospect, stage }
    setProspect(next)
    if (!editing) void save(next, { keepEditing: false })
  }

  async function post(path: string, payload?: unknown) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: payload ? { 'Content-Type': 'application/json' } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Request failed')
      if (data.prospect) applyProspect(data.prospect)
      if (data.messages) setMessages(data.messages)
      if (Array.isArray(data.meetings)) setMeetings(data.meetings)
      if (data.meetLink) {
        setNotice('Meeting scheduled. Join it from the list on this page.')
      } else if (data.documentNumber) {
        setNotice(`Agreement ${data.documentNumber} emailed to the prospect.`)
      } else {
        setNotice(data.replied ? 'The business replied. Stage moved to Responded.' : 'Done.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin/pipeline" className="text-xs font-semibold text-accent hover:underline">← Pipeline</Link>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text mt-2">{prospect.business}</h1>
          <p className="text-sm text-brand-muted">{prospect.contactName || 'Decision-maker not set'} · {scoreBandLabel(total)} ({total}/10)</p>
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
          {editing ? (
            <button type="button" onClick={cancelEdit} className={headerButtonClass}>
              Cancel
            </button>
          ) : (
            <button type="button" onClick={startEdit} className={headerButtonClass}>
              Edit
            </button>
          )}
          {isSales && (
            <Link href="/admin/sales-kit" className={`${headerButtonClass} gap-2`}>
              💼 Sales Kit
            </Link>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-brand-red">{error}</p>}
      {notice && <p className="text-sm text-brand-muted">{notice}</p>}
      {!workspaceConnected && (
        <p className="text-sm text-brand-muted bg-white border border-brand-border rounded-lg px-3 py-2">
          Google Workspace is not connected. Saving still works. Paste a proposal link to finish a handoff. Mail, Calendar, Drive, and Contacts turn on after the sales mailbox token is set.
        </p>
      )}

      <section className="bg-white border border-brand-border rounded-xl p-4 sm:p-5 space-y-5">
        <label className="text-sm block pb-4 border-b border-brand-border">
          <span className="font-medium">Pipeline stage</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.stage}</span>
          <select
            className={`${inputClass} sm:max-w-xs`}
            value={prospect.stage}
            disabled={saving}
            onChange={(event) => changeStage(event.target.value as PipelineStage)}
          >
            {PIPELINE_STAGES.filter((stage) => stage === prospect.stage || canMoveStage(role, prospect.stage, stage)).map((stage) => (
              <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
            ))}
          </select>
        </label>

        {editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="font-medium">Business name</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.business}</span>
          <input className={inputClass} value={prospect.business} onChange={(event) => patch({ business: event.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Contact person</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.contact}</span>
          <input className={inputClass} value={prospect.contactName} onChange={(event) => patch({ contactName: event.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Email</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.email}</span>
          <input type="email" className={inputClass} value={prospect.email} onChange={(event) => patch({ email: event.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Phone</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.phone}</span>
          <input className={inputClass} value={prospect.phone} onChange={(event) => patch({ phone: event.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Industry</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.industry}</span>
          <input className={inputClass} value={prospect.industry} onChange={(event) => patch({ industry: event.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Website</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.website}</span>
          <input className={inputClass} value={prospect.website} onChange={(event) => patch({ website: event.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Location</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.location}</span>
          <input className={inputClass} value={prospect.location} onChange={(event) => patch({ location: event.target.value })} />
        </label>
        <label className="text-sm">
          <span className="font-medium">Prospect category</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.category}</span>
          <select className={inputClass} value={prospect.category} onChange={(event) => patch({ category: event.target.value })}>
            <option value="">Not set</option>
            {PROSPECT_CATEGORIES.map((category) => (
              <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Lead source</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.source}</span>
          <select className={inputClass} value={prospect.source === 'inbound' ? 'website' : prospect.source} onChange={(event) => patch({ source: event.target.value })}>
            {LEAD_SOURCES.filter((source) => source !== 'inbound').map((source) => (
              <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Follow-up</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.followUp}</span>
          <input
            type="datetime-local"
            className={inputClass}
            value={localInput(prospect.followUpAt)}
            onChange={(event) => patch({ followUpAt: event.target.value ? new Date(event.target.value).toISOString() : null })}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Estimated value</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.value}</span>
          <input
            className={inputClass}
            inputMode="decimal"
            value={prospect.estimatedValue ?? ''}
            onChange={(event) => patch({ estimatedValue: event.target.value === '' ? null : Number(event.target.value) })}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Marketing opportunity</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.opportunity}</span>
          <textarea className={inputClass} rows={2} value={prospect.opportunity} onChange={(event) => patch({ opportunity: event.target.value })} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Recommended service</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.service}</span>
          <input className={inputClass} value={prospect.recommendedService} onChange={(event) => patch({ recommendedService: event.target.value })} />
        </label>
        {showScore && (
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium">Prospect score</legend>
            <p className="text-xs text-brand-muted mb-2">{FIELD_PURPOSES.score}. Each factor is 0–2.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCORE_FACTORS.map((factor) => (
                <label key={factor.key} className="text-xs text-brand-muted">
                  {factor.label}
                  <input
                    type="number"
                    min={0}
                    max={2}
                    className={`${inputClass} mt-1`}
                    value={prospect.scoreFactors[factor.key]}
                    onChange={(event) => patch({
                      scoreFactors: { ...prospect.scoreFactors, [factor.key]: Number(event.target.value) },
                    })}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Internal notes</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.notes}</span>
          <textarea className={inputClass} rows={3} value={prospect.notes} onChange={(event) => patch({ notes: event.target.value })} />
        </label>
        <p className="text-xs text-brand-muted sm:col-span-2">
          Last outreach: {prospect.lastContactedAt ? new Date(prospect.lastContactedAt).toLocaleString() : 'None yet'}
        </p>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => void save()} disabled={saving} className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-60">
            {saving ? 'Saving…' : 'Save prospect'}
          </button>
          {canHandOffToSales(role, prospect.stage) && (
            <button type="button" disabled={saving} onClick={() => void post(`/api/admin/pipeline/${id}/handoff`, { target: 'sales_closer' })} className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg disabled:opacity-60">
              Hand to sales
            </button>
          )}
        </div>
        </div>
        ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <Fact label="Business name">{prospect.business}</Fact>
          <Fact label="Contact person">{prospect.contactName}</Fact>
          <Fact label="Email">
            {prospect.email ? <a className="text-accent hover:underline" href={`mailto:${prospect.email}`}>{prospect.email}</a> : ''}
          </Fact>
          <Fact label="Phone">
            {prospect.phone ? <a className="text-accent hover:underline" href={`tel:${prospect.phone}`}>{prospect.phone}</a> : ''}
          </Fact>
          <Fact label="Industry">{prospect.industry}</Fact>
          <Fact label="Website">
            {prospect.website ? (
              <a className="text-accent hover:underline" href={websiteHref(prospect.website)} target="_blank" rel="noreferrer">
                {prospect.website}
              </a>
            ) : ''}
          </Fact>
          <Fact label="Location">{prospect.location}</Fact>
          <Fact label="Prospect category">{isProspectCategory(prospect.category) ? CATEGORY_LABELS[prospect.category] : prospect.category}</Fact>
          <Fact label="Lead source">{sourceLabel(prospect.source)}</Fact>
          <Fact label="Follow-up">{formatWhen(prospect.followUpAt)}</Fact>
          <Fact label="Estimated value">{formatMoney(prospect.estimatedValue)}</Fact>
          <Fact label="Marketing opportunity" wide>{prospect.opportunity}</Fact>
          <Fact label="Recommended service" wide>{prospect.recommendedService}</Fact>
          {showScore && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Prospect score</dt>
              <dd className="mt-1 text-sm text-brand-text">{scoreBandLabel(total)} ({total}/10)</dd>
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SCORE_FACTORS.map((factor) => (
                  <li key={factor.key} className="flex justify-between gap-3 text-sm text-brand-muted">
                    <span>{factor.label}</span>
                    <span className="font-medium text-brand-text tabular-nums">{prospect.scoreFactors[factor.key]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Fact label="Internal notes" wide>{prospect.notes}</Fact>
          <Fact label="Last outreach" wide>{prospect.lastContactedAt ? formatWhen(prospect.lastContactedAt) : 'None yet'}</Fact>
          {canHandOffToSales(role, prospect.stage) && (
            <div className="sm:col-span-2">
              <button type="button" disabled={saving} onClick={() => void post(`/api/admin/pipeline/${id}/handoff`, { target: 'sales_closer' })} className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg disabled:opacity-60">
                Hand to sales
              </button>
            </div>
          )}
        </dl>
        )}
      </section>

      {isSales && (
        <section className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent-soft/40 to-white p-4 sm:p-5 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-brand-text">Sales actions</h2>
            <p className="text-xs text-brand-muted mt-1">
              Schedule the meeting, join it from this page, send the agreement, then bill when the deal is Active.
            </p>
          </div>

          {(meetings.length > 0 || prospect.stage === 'meeting_scheduled') && (
            <div className="rounded-xl border border-brand-border bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-text">Scheduled meeting</h3>
              <MeetingJoinList
                meetings={meetings}
                empty={prospect.stage === 'meeting_scheduled' ? 'The Meet link shows here once the consultation is booked.' : undefined}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-brand-border bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-text">Schedule meeting</h3>
              <label className="text-sm block">
                Date & time
                <input
                  type="datetime-local"
                  className={`${inputClass} mt-1`}
                  value={meetingAt}
                  onChange={(event) => setMeetingAt(event.target.value)}
                />
              </label>
              <label className="text-sm block">
                Duration
                <select
                  className={`${inputClass} mt-1`}
                  value={meetingDuration}
                  onChange={(event) => setMeetingDuration(Number(event.target.value))}
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>
              <label className="text-sm block">
                Notes for the invite
                <textarea
                  className={`${inputClass} mt-1`}
                  rows={2}
                  value={meetingNotes}
                  onChange={(event) => setMeetingNotes(event.target.value)}
                  placeholder="Agenda or dial-in details"
                />
              </label>
              <button
                type="button"
                disabled={saving || !workspaceConnected || !meetingAt}
                onClick={() => void post(`/api/admin/pipeline/${id}/meeting`, {
                  startsAt: new Date(meetingAt).toISOString(),
                  durationMinutes: meetingDuration,
                  notes: meetingNotes,
                })}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-60"
              >
                Schedule meeting
              </button>
              {!prospect.email && (
                <p className="text-xs text-brand-muted">Add an email so the invite can go to the prospect.</p>
              )}
            </div>

            <div className="rounded-xl border border-brand-border bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-brand-text">Send agreement</h3>
              <label className="text-sm block">
                Package
                <select
                  className={`${inputClass} mt-1`}
                  value={agreementTier}
                  onChange={(event) => {
                    const tier = event.target.value
                    setAgreementTier(tier)
                    const defaults = packageDefaults(tier)
                    setAgreementPrice(String(defaults.price || ''))
                    setAgreementPriceType(defaults.priceType)
                  }}
                >
                  {packages.map((pkg) => (
                    <option key={pkg.tier} value={pkg.tier}>{pkg.tier}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm block">
                  Price
                  <input
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                    value={agreementPrice}
                    onChange={(event) => setAgreementPrice(event.target.value)}
                  />
                </label>
                <label className="text-sm block">
                  Billing
                  <select
                    className={`${inputClass} mt-1`}
                    value={agreementPriceType}
                    onChange={(event) => setAgreementPriceType(event.target.value as 'one-time' | 'monthly' | 'custom')}
                  >
                    <option value="one-time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                disabled={saving || !agreementTier || !prospect.email || !prospect.contactName}
                onClick={() => void post(`/api/admin/pipeline/${id}/agreement`, {
                  packageTier: agreementTier,
                  packagePrice: Number(agreementPrice) || 0,
                  priceType: agreementPriceType,
                  customScope: prospect.scope,
                })}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-accent text-white rounded-lg disabled:opacity-60"
              >
                Send agreement
              </button>
              <p className="text-xs text-brand-muted">
                Emails a secure signing link. Or open the{' '}
                <Link href="/admin/sales-kit/agreement/new" className="text-accent hover:underline">full agreement form</Link>
                {' '}in Sales Kit.
              </p>
            </div>
          </div>
        </section>
      )}

      {showOutreach && (
        <section className="bg-white border border-brand-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-brand-text">Outreach</h2>
          <p className="text-xs text-brand-muted">
            {isProcurement
              ? 'First contact scripts and reply checks before handing the lead to sales.'
              : 'Follow up from the sales mailbox and check for replies.'}
          </p>
          <label className="text-sm block">
            Script
            <select
              className={`${inputClass} mt-1`}
              value={scriptId}
              onChange={(event) => {
                const next = scripts.find((script) => script.id === event.target.value)
                setScriptId(event.target.value)
                if (next) {
                  setSubject(next.subject)
                  setBody(next.body)
                }
              }}
            >
              {scripts.map((script) => (
                <option key={script.id} value={script.id}>{script.label}</option>
              ))}
            </select>
          </label>
          {selectedScript?.channel === 'email' ? (
            <>
              <label className="text-sm block">
                Subject
                <input className={`${inputClass} mt-1`} value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>
              <label className="text-sm block">
                Message
                <textarea className={`${inputClass} mt-1`} rows={8} value={body} onChange={(event) => setBody(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={saving || !workspaceConnected} onClick={() => void post(`/api/admin/pipeline/${id}/gmail`, { subject, body })} className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg disabled:opacity-60">
                  Send from sales@
                </button>
                <button type="button" disabled={saving || !prospect.gmailThreadId} onClick={() => void post(`/api/admin/pipeline/${id}/replies`)} className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg disabled:opacity-60">
                  Check replies
                </button>
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm whitespace-pre-wrap text-brand-text">{body}</p>
              <button
                type="button"
                className="mt-2 px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg"
                onClick={() => void navigator.clipboard.writeText(body)}
              >
                Copy introduction
              </button>
            </div>
          )}
          {messages.length > 0 && (
            <ul className="space-y-2">
              {messages.map((message, index) => (
                <li key={`${message.date}-${index}`} className="text-xs text-brand-muted border-t border-brand-border pt-2">
                  <span className="font-medium text-brand-text">{message.from}</span> · {message.date}
                  <p>{message.snippet}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showClose && (
        <section className="bg-white border border-brand-border rounded-xl p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-brand-text">Close</h2>
            <p className="text-xs text-brand-muted mt-1">
              Deal details for billing and the handoff to client relations.
            </p>
          </div>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">Services purchased<input className={`${inputClass} mt-1`} value={prospect.servicesPurchased} onChange={(event) => patch({ servicesPurchased: event.target.value })} /></label>
              <label className="text-sm">Payment status<input className={`${inputClass} mt-1`} value={prospect.paymentStatus} onChange={(event) => patch({ paymentStatus: event.target.value })} /></label>
              <label className="text-sm sm:col-span-2">Scope<textarea className={`${inputClass} mt-1`} rows={2} value={prospect.scope} onChange={(event) => patch({ scope: event.target.value })} /></label>
              <label className="text-sm">Deliverables<input className={`${inputClass} mt-1`} value={prospect.deliverables} onChange={(event) => patch({ deliverables: event.target.value })} /></label>
              <label className="text-sm">Deadline<input className={`${inputClass} mt-1`} value={prospect.deadline} onChange={(event) => patch({ deadline: event.target.value })} /></label>
              <label className="text-sm">Promises<textarea className={`${inputClass} mt-1`} rows={2} value={prospect.promises} onChange={(event) => patch({ promises: event.target.value })} /></label>
              <label className="text-sm">Expectations<textarea className={`${inputClass} mt-1`} rows={2} value={prospect.expectations} onChange={(event) => patch({ expectations: event.target.value })} /></label>
              <label className="text-sm flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(prospect.closeMethod)}
                  onChange={(event) => patch({ closeMethod: event.target.checked ? 'nonstandard' : null })}
                />
                Closed without proposal (skipped standard flow)
              </label>
              <label className="text-sm sm:col-span-2">
                Proposal / agreement link
                <span className="block text-xs text-brand-muted mb-1">Filled automatically when you send an agreement, or paste a Google Doc link.</span>
                <input className={inputClass} value={prospect.proposalDocUrl || ''} onChange={(event) => patch({ proposalDocUrl: event.target.value || null })} />
              </label>
              <label className="text-sm flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(prospect.agreementSignedAt)}
                  onChange={(event) => patch({ agreementSignedAt: event.target.checked ? new Date().toISOString() : null })}
                />
                Agreement signed
              </label>
              <div className="sm:col-span-2">
                <button type="button" disabled={saving} onClick={() => void save()} className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg">Save close details</button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <Fact label="Services purchased">{prospect.servicesPurchased}</Fact>
              <Fact label="Payment status">{prospect.paymentStatus}</Fact>
              <Fact label="Scope" wide>{prospect.scope}</Fact>
              <Fact label="Deliverables">{prospect.deliverables}</Fact>
              <Fact label="Deadline">{prospect.deadline}</Fact>
              <Fact label="Promises">{prospect.promises}</Fact>
              <Fact label="Expectations">{prospect.expectations}</Fact>
              <Fact label="Close method" wide>{prospect.closeMethod ? 'Closed without proposal' : ''}</Fact>
              <Fact label="Proposal / agreement" wide>
                {prospect.proposalDocUrl ? (
                  <a href={prospect.proposalDocUrl} className="text-accent hover:underline" target="_blank" rel="noreferrer">Open proposal / agreement</a>
                ) : ''}
              </Fact>
              <Fact label="Agreement signed">{prospect.agreementSignedAt ? 'Yes' : 'No'}</Fact>
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !workspaceConnected}
              onClick={() => void post(`/api/admin/pipeline/${id}/proposal`, {
                service: prospect.recommendedService,
                price: prospect.estimatedValue != null ? String(prospect.estimatedValue) : '',
                scope: prospect.scope,
                deadline: prospect.deadline,
              })}
              className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg disabled:opacity-60"
            >
              Create proposal Doc
            </button>
            {canHandOffToRelations(role, prospect.stage) && (
              <button type="button" disabled={saving} onClick={() => void post(`/api/admin/pipeline/${id}/handoff`, { target: 'client_relations' })} className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-60">
                Hand to client relations
              </button>
            )}
            {prospect.driveFolderUrl && (
              <a href={prospect.driveFolderUrl} className="px-4 py-2 text-sm font-semibold text-accent hover:underline" target="_blank" rel="noreferrer">Open Drive folder</a>
            )}
            {prospect.creditApplicationId && (
              <Link href={`/admin/credit-funding?id=${prospect.creditApplicationId}`} className="px-4 py-2 text-sm font-semibold text-accent hover:underline">
                Open in Credit & Funding
              </Link>
            )}
          </div>
        </section>
      )}

      {isSales && prospect.stage === 'won' && (
        <CloserBilling
          prospectId={prospect.id}
          business={prospect.business}
          servicesPurchased={prospect.servicesPurchased}
          paymentStatus={prospect.paymentStatus}
        />
      )}
    </div>
  )
}
