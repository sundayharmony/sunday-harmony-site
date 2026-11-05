'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import MeetingJoinList from '@/components/admin/MeetingJoinList'
import type { JoinableMeeting } from '@/lib/joinable-meetings'
import { safeMeetHref } from '@/lib/joinable-meetings'
import {
  CATEGORY_LABELS,
  FIELD_PURPOSES,
  LEAD_SOURCES,
  PROSPECT_CATEGORIES,
  SOURCE_LABELS,
  STAGE_LABELS,
  comparePipelineProspects,
  filterPipelineProspects,
  pipelineProspectMatchesQuery,
  prospectVisibleInBoardStage,
  scoreBand,
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
  handedToRelationsAt: string | null
  source: string
  meetLink?: string
  calendarLink?: string
}

type BoardLane = {
  id: string
  title: string
  detail: string
  stages: PipelineStage[]
}

type PipelineView = 'list' | 'board'

const PIPELINE_VIEW_KEY = 'sh-pipeline-view'
const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-xl text-sm'
const LANE_WASH = ['bg-accent-soft', 'bg-white', 'bg-neutral-100'] as const

function formatFollowUp(iso: string | null): string {
  if (!iso) return 'No follow-up'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'No follow-up'
  const when = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `Follow-up ${when}`
}

function scoreMarkClass(score: number): string {
  const band = scoreBand(score)
  if (band === 'high') return 'bg-accent text-brand-text'
  if (band === 'medium') return 'bg-accent-soft text-brand-text'
  return 'bg-neutral-100 text-brand-muted'
}

function meetingAction(row: ProspectCard) {
  const meetHref = safeMeetHref(row.meetLink || '')
  const calendarHref = safeMeetHref(row.calendarLink || '')
  if (meetHref) return { href: meetHref, label: 'Join meeting' }
  if (calendarHref) return { href: calendarHref, label: 'Open in Calendar' }
  return null
}

function ScoreMark({ score }: { score: number | null }) {
  if (score == null || !Number.isFinite(score)) return null
  return (
    <span
      className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${scoreMarkClass(score)}`}
      aria-label={`Score ${score} of 10`}
    >
      {score}
    </span>
  )
}

function ProspectLink({ row, href }: { row: ProspectCard; href: string }) {
  const score = row.score != null && Number.isFinite(row.score) ? row.score : null
  const action = meetingAction(row)
  return (
    <div className="overflow-hidden rounded-xl bg-white border border-brand-border">
      <div className="flex">
        <span className="w-[3px] shrink-0 bg-accent" aria-hidden />
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <Link href={href} className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-brand-text">{row.business}</span>
              <span className="mt-0.5 block truncate text-xs text-brand-muted">{row.contactName || 'No contact'}</span>
              <span className="mt-1 block text-xs text-brand-dim">{formatFollowUp(row.followUpAt)}</span>
            </span>
            <ScoreMark score={score} />
          </Link>
          {action && (
            <a
              href={action.href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-brand-text px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              {action.label}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function ProspectListRow({ row, href }: { row: ProspectCard; href: string }) {
  const action = meetingAction(row)
  return (
    <div className="border-b border-brand-border last:border-0 hover:bg-neutral-50/80">
      <div className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
        <Link href={href} className="min-w-0 flex-1 grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto_minmax(0,0.9fr)] sm:items-center sm:gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-brand-text">{row.business}</span>
            <span className="mt-0.5 block truncate text-xs text-brand-muted sm:hidden">{row.contactName || 'No contact'}</span>
          </span>
          <span className="hidden truncate text-xs text-brand-muted sm:block">{row.contactName || 'No contact'}</span>
          <span className="text-xs font-medium text-brand-text">{STAGE_LABELS[row.stage]}</span>
          <span className="flex items-center gap-2">
            <ScoreMark score={row.score} />
            <span className="text-xs text-brand-dim sm:hidden">{formatFollowUp(row.followUpAt)}</span>
          </span>
          <span className="hidden truncate text-xs text-brand-dim sm:block">{formatFollowUp(row.followUpAt)}</span>
        </Link>
        {action && (
          <a
            href={action.href}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg bg-brand-text px-2.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
          >
            {action.label}
          </a>
        )}
      </div>
    </div>
  )
}

function AddButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-brand-text px-5 py-2 text-sm font-semibold text-white"
    >
      {open ? 'Close' : 'Add prospect'}
    </button>
  )
}

function ViewToggle({ view, onChange }: { view: PipelineView; onChange: (next: PipelineView) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {([
        ['list', 'List'],
        ['board', 'Board'],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            view === key
              ? 'bg-accent-soft border border-accent text-accent'
              : 'bg-gray-50 border border-brand-border text-brand-muted hover:text-brand-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function MarketingPipeline() {
  const [prospects, setProspects] = useState<ProspectCard[]>([])
  const [lanes, setLanes] = useState<BoardLane[]>([])
  const [role, setRole] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage | ''>('')
  const [view, setView] = useState<PipelineView>('list')
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
      setLoaded(true)
      return
    }
    setProspects(data.prospects || [])
    setLanes(Array.isArray(data.lanes) ? data.lanes : [])
    setRole(typeof data.role === 'string' ? data.role : '')
    setLoaded(true)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(PIPELINE_VIEW_KEY)
    if (stored === 'list' || stored === 'board') setView(stored)
  }, [])

  function changeView(next: PipelineView) {
    setView(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(PIPELINE_VIEW_KEY, next)
  }

  const canAdd = loaded && role !== 'client_relations'
  const subtitle = role === 'sales_closer'
    ? 'Join a scheduled meeting from its card or from Today, bill Active clients, then hand the client to client relations.'
    : 'Each role works only the stages they own.'
  const dashboardMeetings: JoinableMeeting[] = (role === 'sales_closer' || role === 'admin')
    ? prospects
      .filter((row) => row.meetLink || row.calendarLink || row.stage === 'meeting_scheduled')
      .map((row) => ({
        id: row.id,
        prospectId: row.id,
        business: row.business,
        title: row.business,
        startsAt: row.followUpAt || '',
        meetLink: row.meetLink || '',
        calendarLink: row.calendarLink || '',
      }))
    : []

  const cardHref = (row: ProspectCard) => (
    role === 'client_relations' ? '/admin/clients' : `/admin/pipeline/${row.id}`
  )

  const stageOptions = useMemo(() => {
    const seen = new Set<PipelineStage>()
    const options: PipelineStage[] = []
    for (const lane of lanes) {
      for (const stage of lane.stages) {
        if (seen.has(stage)) continue
        seen.add(stage)
        options.push(stage)
      }
    }
    return options
  }, [lanes])

  const visibleProspects = useMemo(
    () => prospects.filter((row) => stageOptions.includes(row.stage) && prospectVisibleInBoardStage(role, row, row.stage)),
    [prospects, role, stageOptions]
  )

  const filteredProspects = useMemo(
    () => filterPipelineProspects(visibleProspects, { query, stage: stageFilter }),
    [visibleProspects, query, stageFilter]
  )

  const laneRows = useMemo(() => {
    return lanes.map((lane) => ({
      lane,
      stages: lane.stages.map((stage) => ({
        stage,
        rows: visibleProspects
          .filter((row) => prospectVisibleInBoardStage(role, row, stage))
          .filter((row) => pipelineProspectMatchesQuery(row, query))
          .filter((row) => !stageFilter || row.stage === stageFilter)
          .slice()
          .sort(comparePipelineProspects),
      })),
    }))
  }, [lanes, visibleProspects, role, query, stageFilter])

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

  const showing = filteredProspects.length
  const total = visibleProspects.length

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-extrabold text-brand-text">Pipeline</h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">{loaded ? subtitle : 'Loading the pipeline.'}</p>
        </div>
        {canAdd && <AddButton open={open} onClick={() => setOpen((value) => !value)} />}
      </div>

      {(role === 'sales_closer' || role === 'admin') && (
        <section className="mb-5 rounded-2xl bg-gradient-to-br from-blue-50/70 to-white border border-blue-100 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-brand-text">Meetings</h2>
          <p className="mt-1 mb-3 text-xs text-brand-muted">Open the Google Meet from here. The same Join button is on the Meeting scheduled card.</p>
          <MeetingJoinList
            meetings={dashboardMeetings}
            showBusiness
            empty="When a meeting is scheduled, Join shows up here and on the pipeline card."
          />
        </section>
      )}

      {error && <p className="mb-3 text-sm text-brand-red">{error}</p>}
      {notice && <p className="mb-3 text-sm text-brand-muted">{notice}</p>}

      {open && canAdd && (
        <form onSubmit={createProspect} className="mb-6 grid grid-cols-1 gap-3 rounded-3xl bg-white p-4 shadow-[0_16px_40px_-28px_rgba(10,10,10,0.45)] sm:grid-cols-2 sm:p-5">
          <label className="text-sm">
            <span className="font-medium">Business name</span>
            <span className="mb-1 block text-xs text-brand-muted">{FIELD_PURPOSES.business}</span>
            <input className={inputClass} required value={form.business} onChange={(event) => setForm({ ...form, business: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Contact person</span>
            <span className="mb-1 block text-xs text-brand-muted">{FIELD_PURPOSES.contact}</span>
            <input className={inputClass} value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Email</span>
            <span className="mb-1 block text-xs text-brand-muted">{FIELD_PURPOSES.email}</span>
            <input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Phone</span>
            <span className="mb-1 block text-xs text-brand-muted">{FIELD_PURPOSES.phone}</span>
            <input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Follow-up</span>
            <span className="mb-1 block text-xs text-brand-muted">{FIELD_PURPOSES.followUp}</span>
            <input type="datetime-local" required className={inputClass} value={form.followUpAt} onChange={(event) => setForm({ ...form, followUpAt: event.target.value })} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Lead source</span>
            <span className="mb-1 block text-xs text-brand-muted">{FIELD_PURPOSES.source}</span>
            <select className={inputClass} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>
              {LEAD_SOURCES.filter((source) => source !== 'inbound').map((source) => (
                <option key={source} value={source}>{SOURCE_LABELS[source as LeadSource]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Category</span>
            <span className="mb-1 block text-xs text-brand-muted">{FIELD_PURPOSES.category}</span>
            <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="">Not set</option>
              {PROSPECT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-medium">Marketing opportunity</span>
            <span className="mb-1 block text-xs text-brand-muted">{FIELD_PURPOSES.opportunity}</span>
            <textarea className={inputClass} rows={2} value={form.opportunity} onChange={(event) => setForm({ ...form, opportunity: event.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Save prospect'}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <label className="block min-w-0 flex-1 sm:max-w-sm">
            <span className="sr-only">Search businesses</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search businesses"
              className={inputClass}
            />
          </label>
          <label className="sm:w-52">
            <span className="sr-only">Filter by stage</span>
            <select
              className={inputClass}
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value as PipelineStage | '')}
            >
              <option value="">All stages</option>
              {stageOptions.map((stage) => (
                <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <p className="text-xs font-medium tabular-nums text-brand-muted">
            {showing === total ? `${total} ${total === 1 ? 'prospect' : 'prospects'}` : `Showing ${showing} of ${total}`}
          </p>
          <ViewToggle view={view} onChange={changeView} />
        </div>
      </div>

      {view === 'list' ? (
        <section className="overflow-hidden rounded-2xl border border-brand-border bg-white">
          <div className="hidden border-b border-brand-border bg-neutral-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-brand-dim sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto_minmax(0,0.9fr)] sm:gap-3">
            <span>Business</span>
            <span>Contact</span>
            <span>Stage</span>
            <span>Score</span>
            <span>Follow-up</span>
          </div>
          {filteredProspects.length === 0 ? (
            <p className="px-4 py-8 text-sm text-brand-muted">
              {loaded ? (total === 0 ? 'No prospects in your lanes yet.' : 'No businesses match that search.') : 'Loading the pipeline.'}
            </p>
          ) : (
            filteredProspects.map((row) => (
              <ProspectListRow key={row.id} row={row} href={cardHref(row)} />
            ))
          )}
        </section>
      ) : (
        <div className="space-y-5">
          {laneRows.map(({ lane, stages }, index) => {
            const count = stages.reduce((sum, group) => sum + group.rows.length, 0)
            return (
              <section
                key={lane.id}
                className={`rounded-3xl px-4 py-5 md:px-6 md:py-6 ${LANE_WASH[index % LANE_WASH.length]} ${index % LANE_WASH.length === 1 ? 'shadow-[0_18px_40px_-30px_rgba(10,10,10,0.4)]' : ''}`}
              >
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0 max-w-2xl">
                    <h2 className="font-serif text-2xl font-extrabold text-brand-text md:text-3xl">{lane.title}</h2>
                    <p className="mt-1 text-sm text-brand-muted">{lane.detail}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-brand-text">
                    {count}
                    <span className="ml-1 font-medium text-brand-muted">{count === 1 ? 'prospect' : 'prospects'}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-5 md:flex-row md:gap-3 md:overflow-x-auto md:pb-2">
                  {stages.map((group) => (
                    <div
                      key={group.stage}
                      className="flex min-h-[12rem] max-h-[min(70vh,36rem)] min-w-0 flex-col overflow-hidden rounded-xl border border-brand-border/70 bg-white/70 md:w-[240px] md:shrink-0"
                    >
                      <div className="shrink-0 border-b border-brand-border px-3 py-2">
                        <h3 className="font-serif text-base font-bold text-brand-text">{STAGE_LABELS[group.stage]}</h3>
                        <p className="text-[11px] font-semibold tabular-nums text-brand-dim">{group.rows.length}</p>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2">
                        {group.rows.length === 0 ? (
                          <p className="px-1 py-2 text-sm text-brand-muted">None yet.</p>
                        ) : (
                          group.rows.map((row) => (
                            <ProspectLink key={row.id} row={row} href={cardHref(row)} />
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
