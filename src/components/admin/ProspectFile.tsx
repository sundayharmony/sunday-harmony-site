'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
}

type Script = { id: string; label: string; channel: 'email' | 'copy'; subject: string; body: string }
type ThreadMessage = { from: string; date: string; snippet: string }

const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm'

function localInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
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
      setWorkspaceConnected(Boolean(data.workspaceConnected))
    })()
  }, [id])

  if (error && !prospect) return <p className="text-sm text-brand-red">{error}</p>
  if (!prospect) return <p className="text-sm text-brand-muted">Loading prospect…</p>

  const total = scoreTotal(prospect.scoreFactors)
  const selectedScript = scripts.find((script) => script.id === scriptId)

  function patch(partial: Partial<Prospect>) {
    setProspect((current) => (current ? { ...current, ...partial } : current))
  }

  async function save() {
    if (!prospect) return
    const current = prospect
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
      setNotice(data.warning || 'Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
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
      setNotice(data.replied ? 'The business replied. Stage moved to Responded.' : 'Done.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/pipeline" className="text-xs font-semibold text-accent hover:underline">← Pipeline</Link>
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mt-2">{prospect.business}</h1>
        <p className="text-sm text-brand-muted">{prospect.contactName || 'Decision-maker not set'} · {scoreBandLabel(total)} ({total}/10)</p>
      </div>
      {error && <p className="text-sm text-brand-red">{error}</p>}
      {notice && <p className="text-sm text-brand-muted">{notice}</p>}
      {!workspaceConnected && (
        <p className="text-sm text-brand-muted bg-white border border-brand-border rounded-lg px-3 py-2">
          Google Workspace is not connected. Saving still works. Paste a proposal link to finish a handoff. Mail, Calendar, Drive, and Contacts turn on after the sales mailbox token is set.
        </p>
      )}

      <section className="bg-white border border-brand-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Pipeline stage</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.stage}</span>
          <select className={inputClass} value={prospect.stage} onChange={(event) => patch({ stage: event.target.value as PipelineStage })}>
            {PIPELINE_STAGES.filter((stage) => stage === prospect.stage || canMoveStage(role, prospect.stage, stage)).map((stage) => (
              <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
            ))}
          </select>
        </label>
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
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Internal notes</span>
          <span className="block text-xs text-brand-muted mb-1">{FIELD_PURPOSES.notes}</span>
          <textarea className={inputClass} rows={3} value={prospect.notes} onChange={(event) => patch({ notes: event.target.value })} />
        </label>
        <p className="text-xs text-brand-muted sm:col-span-2">
          Last outreach: {prospect.lastContactedAt ? new Date(prospect.lastContactedAt).toLocaleString() : 'None yet'}
        </p>
        <div className="sm:col-span-2">
          <button type="button" onClick={() => void save()} disabled={saving} className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-60">
            {saving ? 'Saving…' : 'Save prospect'}
          </button>
        </div>
      </section>

      <section className="bg-white border border-brand-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-brand-text">Outreach</h2>
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

      <section className="bg-white border border-brand-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <h2 className="text-sm font-bold text-brand-text sm:col-span-2">Close</h2>
        <label className="text-sm">Services purchased<input className={`${inputClass} mt-1`} value={prospect.servicesPurchased} onChange={(event) => patch({ servicesPurchased: event.target.value })} /></label>
        <label className="text-sm">Payment status<input className={`${inputClass} mt-1`} value={prospect.paymentStatus} onChange={(event) => patch({ paymentStatus: event.target.value })} /></label>
        <label className="text-sm sm:col-span-2">Scope<textarea className={`${inputClass} mt-1`} rows={2} value={prospect.scope} onChange={(event) => patch({ scope: event.target.value })} /></label>
        <label className="text-sm">Deliverables<input className={`${inputClass} mt-1`} value={prospect.deliverables} onChange={(event) => patch({ deliverables: event.target.value })} /></label>
        <label className="text-sm">Deadline<input className={`${inputClass} mt-1`} value={prospect.deadline} onChange={(event) => patch({ deadline: event.target.value })} /></label>
        <label className="text-sm">Promises<textarea className={`${inputClass} mt-1`} rows={2} value={prospect.promises} onChange={(event) => patch({ promises: event.target.value })} /></label>
        <label className="text-sm">Expectations<textarea className={`${inputClass} mt-1`} rows={2} value={prospect.expectations} onChange={(event) => patch({ expectations: event.target.value })} /></label>
        <label className="text-sm sm:col-span-2">
          Proposal link
          <span className="block text-xs text-brand-muted mb-1">Paste the Google Doc address. The create button turns on after Google is connected.</span>
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
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="button" disabled={saving} onClick={() => void save()} className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg">Save close details</button>
          {(role === 'admin' || role === 'sales_closer') && (
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
          )}
          {canHandOffToSales(role, prospect.stage) && (
            <button type="button" disabled={saving} onClick={() => void post(`/api/admin/pipeline/${id}/handoff`, { target: 'sales_closer' })} className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-60">
              Hand to sales
            </button>
          )}
          {canHandOffToRelations(role, prospect.stage) && (
            <button type="button" disabled={saving} onClick={() => void post(`/api/admin/pipeline/${id}/handoff`, { target: 'client_relations' })} className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-60">
              Hand to client relations
            </button>
          )}
        </div>
        {prospect.proposalDocUrl && (
          <a href={prospect.proposalDocUrl} className="text-sm text-accent hover:underline" target="_blank" rel="noreferrer">Open proposal</a>
        )}
        {prospect.driveFolderUrl && (
          <a href={prospect.driveFolderUrl} className="text-sm text-accent hover:underline" target="_blank" rel="noreferrer">Open Drive folder</a>
        )}
        {prospect.creditApplicationId && (
          <Link href={`/admin/credit-funding?id=${prospect.creditApplicationId}`} className="text-sm text-accent hover:underline sm:col-span-2">
            Open in Credit & Funding
          </Link>
        )}
      </section>
    </div>
  )
}
