'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import MarketingPipeline from '@/components/admin/MarketingPipeline'
import MeetingJoinList from '@/components/admin/MeetingJoinList'
import OutreachConsole from '@/components/admin/OutreachConsole'
import LeadDrawer, { type DrawerStep } from '@/components/admin/marketing/LeadDrawer'
import type { JoinableMeeting } from '@/lib/joinable-meetings'
import { isPipelineStage, STAGE_LABELS, type MarketingKpiView, type PipelineStage } from '@/lib/marketing-pipeline'
import type {
  ClientAccount,
  QueueGroup,
  QueueItem,
  WorkspaceInsights,
  WorkspacePulse,
} from '@/lib/marketing-workspace'

/**
 * The marketing workspace. Everything connects through two things:
 * the pulse bar (stage counts that filter the pipeline) and one lead drawer
 * that opens from the queue, the pipeline, and client accounts alike.
 * View, stage, and open lead live in the URL so any of them can be linked.
 */

type WorkspacePayload = {
  role: string
  canEdit: boolean
  pulse: WorkspacePulse
  queue: QueueGroup[]
  accounts: ClientAccount[]
  insights: WorkspaceInsights
  kpis: MarketingKpiView
  meetings: JoinableMeeting[]
  workspaceConnected: boolean
  error?: string
}

const VIEWS = [
  { id: 'today', label: 'Today' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'clients', label: 'Clients' },
  { id: 'insights', label: 'Insights' },
  { id: 'outreach', label: 'Outreach' },
] as const

type ViewId = (typeof VIEWS)[number]['id']

/** Links saved before the workspace used ?section=. */
const LEGACY_SECTIONS: Record<string, ViewId> = {
  replies: 'today',
  leads: 'pipeline',
  outreach: 'outreach',
  pipeline: 'pipeline',
  clients: 'clients',
  deadlines: 'clients',
  kpis: 'insights',
}

const SUBTITLES: Record<string, string> = {
  admin: 'Every lead, call, and client in one place. Start with Today and work down.',
  sales_closer: 'Work Today from the top. Log every call and the next follow-up books itself.',
  lead_procurement: 'Research leads, fill the gaps, and hand finished files to sales.',
  client_relations: 'Your active clients, where onboarding stands, and what is due next.',
}

const kicker = 'text-[11px] font-bold uppercase tracking-[0.14em] text-accent-ink'
const card = 'rounded-[22px] border border-brand-border bg-white'

function money(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0'
  if (value >= 10000) return `$${Math.round(value / 1000)}k`
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function MarketingDesk() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<WorkspacePayload | null>(null)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [checking, setChecking] = useState(false)
  const [checkNote, setCheckNote] = useState('')
  const reloadTimer = useRef<number | null>(null)

  const role = data?.role || ''
  const views = VIEWS.filter((item) => item.id !== 'outreach' || (role && role !== 'client_relations'))
  const requestedView = params.get('view') || LEGACY_SECTIONS[params.get('section') || ''] || 'today'
  const view: ViewId = (views.some((item) => item.id === requestedView) ? requestedView : 'today') as ViewId
  const stageParam = params.get('stage')
  const stage: PipelineStage | '' = isPipelineStage(stageParam) ? stageParam : ''
  const leadId = params.get('lead')

  const setQuery = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    next.delete('section')
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [params, pathname, router])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketing')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not load marketing')
      setData(body)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load marketing')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** A change in the drawer refreshes the queue and pipeline, batched so fast call logging stays smooth. */
  const changed = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current)
    reloadTimer.current = window.setTimeout(() => {
      void load()
      setRefreshKey((key) => key + 1)
    }, 600)
  }, [load])

  const openLead = useCallback((id: string) => setQuery({ lead: id }), [setQuery])
  const closeLead = useCallback(() => setQuery({ lead: null }), [setQuery])

  // The drawer's "Next" walks the list the lead was opened from.
  const [sequence, setSequence] = useState<DrawerStep[]>([])
  const queueSequence = useMemo<DrawerStep[]>(
    () => (data?.queue || []).flatMap((group) => group.items.map((item) => ({ id: item.id, business: item.business }))),
    [data]
  )
  const openFromQueue = useCallback((id: string) => {
    setSequence(queueSequence)
    openLead(id)
  }, [openLead, queueSequence])
  const openSingle = useCallback((id: string) => {
    setSequence([])
    openLead(id)
  }, [openLead])

  const checkReplies = async () => {
    setChecking(true)
    setCheckNote('')
    try {
      const res = await fetch('/api/admin/marketing', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not check replies')
      setCheckNote(`Checked ${body.checked} threads · ${body.replied} new ${body.replied === 1 ? 'reply' : 'replies'}${body.failed ? ` · ${body.failed} unreadable` : ''}`)
      await load()
    } catch (err) {
      setCheckNote(err instanceof Error ? err.message : 'Could not check replies')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className={kicker}>Marketing</p>
          <h1 className="mt-1 font-serif text-3xl text-brand-text sm:text-4xl">Growth desk</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">{SUBTITLES[role] || SUBTITLES.admin}</p>
        </div>
        {data?.canEdit && (
          <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-3">
            <p className="order-2 text-xs text-brand-muted sm:order-1" role="status">{checkNote || (data.workspaceConnected ? 'Gmail is also checked daily.' : 'Gmail is not connected.')}</p>
            <button
              type="button"
              onClick={() => void checkReplies()}
              disabled={checking || !data.workspaceConnected}
              className="order-1 inline-flex min-h-11 items-center justify-center rounded-full border border-brand-border bg-white px-5 text-sm font-semibold text-brand-text hover:border-accent disabled:opacity-50 sm:order-2"
            >
              {checking ? 'Checking Gmail…' : 'Check replies'}
            </button>
          </div>
        )}
      </header>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <PulseBar
        pulse={data?.pulse || null}
        role={role}
        activeStage={view === 'pipeline' ? stage : ''}
        onStage={(next) => setQuery({ view: 'pipeline', stage: next === stage && view === 'pipeline' ? null : next })}
      />

      <nav aria-label="Marketing views" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-max gap-1 rounded-full border border-brand-border bg-white p-1">
          {views.map((item) => {
            const active = item.id === view
            const badge = item.id === 'today'
              ? (data?.pulse.repliesWaiting || 0) + (data?.pulse.callbacksDue || 0)
              : item.id === 'clients'
                ? (data?.accounts || []).filter((account) => account.health === 'at_risk').length
                : 0
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setQuery({ view: item.id === 'today' ? null : item.id, stage: item.id === 'pipeline' ? stage || null : null })}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                  active ? 'bg-brand-text text-white' : 'text-brand-muted hover:text-brand-text'
                }`}
              >
                {item.label}
                {badge > 0 && (
                  <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-accent text-brand-text' : 'bg-accent-soft text-brand-text'}`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {!data && !error && <p className="text-sm text-brand-muted">Loading the desk…</p>}

      {data && view === 'today' && (
        <TodayView data={data} onOpen={openFromQueue} onOpenSingle={openSingle} onView={(next) => setQuery({ view: next })} />
      )}
      {data && view === 'pipeline' && (
        <MarketingPipeline embedded stage={stage} onOpenProspect={openSingle} refreshKey={refreshKey} />
      )}
      {data && view === 'clients' && <ClientsView accounts={data.accounts} role={role} onOpen={openSingle} />}
      {data && view === 'insights' && <InsightsView insights={data.insights} kpis={data.kpis} />}
      {data && view === 'outreach' && <OutreachConsole />}

      <LeadDrawer
        id={leadId}
        role={role || 'admin'}
        canEdit={Boolean(data?.canEdit)}
        sequence={sequence}
        onClose={closeLead}
        onOpen={openLead}
        onChanged={changed}
      />
    </div>
  )
}

// ---------- Pulse ----------

function PulseBar({
  pulse,
  role,
  activeStage,
  onStage,
}: {
  pulse: WorkspacePulse | null
  role: string
  activeStage: PipelineStage | ''
  onStage: (stage: PipelineStage) => void
}) {
  if (!pulse) return <div className={`${card} h-[132px] animate-pulse bg-brand-bg-soft`} aria-hidden />
  const callPercent = Math.min(100, Math.round((pulse.callsToday / Math.max(1, pulse.target)) * 100))
  const showCalls = role === 'admin' || role === 'sales_closer'
  return (
    <section aria-label="Pipeline pulse" className={`${card} overflow-hidden`}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-x-auto border-b border-brand-border lg:border-b-0 lg:border-r">
          <ol className="flex min-w-max snap-x">
            {pulse.stages.map((row, index) => {
              const active = row.stage === activeStage
              return (
                <li key={row.stage} className="snap-start">
                  <button
                    type="button"
                    onClick={() => onStage(row.stage)}
                    aria-pressed={active}
                    title={`Show ${STAGE_LABELS[row.stage]} in the pipeline`}
                    className={`group relative flex h-full min-w-[124px] flex-col items-start gap-0.5 px-4 py-4 text-left transition sm:min-w-[136px] ${
                      active ? 'bg-accent-soft' : 'hover:bg-brand-bg'
                    }`}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">{row.label}</span>
                    <span className="font-serif text-3xl tabular-nums text-brand-text">{row.count}</span>
                    <span className="text-xs tabular-nums text-brand-muted">{money(row.value)}</span>
                    {index < pulse.stages.length - 2 && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-border" aria-hidden>›</span>
                    )}
                    <span className={`absolute inset-x-4 bottom-0 h-[3px] rounded-full transition ${active ? 'bg-accent' : 'bg-transparent group-hover:bg-brand-border'}`} aria-hidden />
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="flex flex-col justify-center gap-3 px-4 py-4 sm:px-5">
          {showCalls ? (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-brand-text">Calls today</p>
                <p className="text-sm tabular-nums text-brand-muted">
                  <span className="font-semibold text-brand-text">{pulse.callsToday}</span> / {pulse.target}
                </p>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-brand-bg-soft"
                role="progressbar"
                aria-label="Calls logged today"
                aria-valuemin={0}
                aria-valuemax={pulse.target}
                aria-valuenow={pulse.callsToday}
              >
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${callPercent}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-sm font-semibold text-brand-text">Open pipeline {money(pulse.openValue)}</p>
          )}
          <dl className="grid grid-cols-3 gap-2 text-center">
            <PulseStat label="Talked" value={pulse.conversationsToday} />
            <PulseStat label="Replies" value={pulse.repliesWaiting} highlight={pulse.repliesWaiting > 0} />
            <PulseStat label="Callbacks" value={pulse.callbacksDue} highlight={pulse.callbacksDue > 0} />
          </dl>
        </div>
      </div>
    </section>
  )
}

function PulseStat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-1.5 ${highlight ? 'bg-accent-soft' : 'bg-brand-bg'}`}>
      <dd className="text-lg font-semibold tabular-nums text-brand-text">{value}</dd>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-brand-dim">{label}</dt>
    </div>
  )
}

// ---------- Today ----------

function TodayView({
  data,
  onOpen,
  onOpenSingle,
  onView,
}: {
  data: WorkspacePayload
  onOpen: (id: string) => void
  onOpenSingle: (id: string) => void
  onView: (view: ViewId) => void
}) {
  const showMeetings = data.role === 'admin' || data.role === 'sales_closer'
  const dueAccounts = data.accounts.filter((account) => account.health !== 'on_track' || account.nextTask).slice(0, 5)
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        {data.queue.length === 0 ? (
          <div className={`${card} p-6`}>
            <p className="font-serif text-xl text-brand-text">Nothing waiting on you.</p>
            <p className="mt-1 text-sm text-brand-muted">No replies, callbacks, or handoffs are due. Open the pipeline to pick the next lead.</p>
            <button type="button" onClick={() => onView('pipeline')} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand-text px-5 text-sm font-semibold text-white">
              Open the pipeline
            </button>
          </div>
        ) : (
          data.queue.map((group) => <QueueSection key={group.key} group={group} onOpen={onOpen} />)
        )}
      </div>

      <aside className="min-w-0 space-y-5">
        {showMeetings && (
          <section className={`${card} p-4 sm:p-5`}>
            <p className={kicker}>Meetings</p>
            <h2 className="mt-1 font-serif text-xl text-brand-text">Coming up</h2>
            <div className="mt-3">
              <MeetingJoinList meetings={data.meetings.slice(0, 5)} showBusiness empty="No meetings booked. Schedule one from a lead's full file." />
            </div>
          </section>
        )}
        <section className={`${card} p-4 sm:p-5`}>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className={kicker}>Clients</p>
              <h2 className="mt-1 font-serif text-xl text-brand-text">Due and at risk</h2>
            </div>
            <button type="button" onClick={() => onView('clients')} className="text-sm font-semibold text-accent-ink hover:underline">All</button>
          </div>
          {dueAccounts.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted">No active client work is due.</p>
          ) : (
            <ul className="mt-3 divide-y divide-brand-border">
              {dueAccounts.map((account) => (
                <li key={account.id}>
                  <button type="button" onClick={() => onOpenSingle(account.id)} className="flex w-full items-start gap-3 py-2.5 text-left">
                    <HealthDot health={account.health} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-brand-text">{account.business}</span>
                      <span className="block truncate text-xs text-brand-muted">
                        {account.nextTask ? `${account.nextTask.title} · due ${account.nextTask.dueDate}` : account.reasons[0] || 'On track'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${card} p-4 sm:p-5`}>
          <p className={kicker}>How the queue works</p>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Replies first, then callbacks you set, then offers and quiet emails, then fresh leads ranked by score and value.
            Logging a call removes the lead from today and books its next follow-up. Reminders older than 3 days drop off so the list stays real.
          </p>
        </section>
      </aside>
    </div>
  )
}

const QUEUE_PREVIEW = 5

function QueueSection({ group, onOpen }: { group: QueueGroup; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? group.items : group.items.slice(0, QUEUE_PREVIEW)
  const hidden = group.items.length - rows.length
  return (
    <section className={`${card} overflow-hidden`} aria-labelledby={`queue-${group.key}`}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-brand-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 id={`queue-${group.key}`} className="font-serif text-xl text-brand-text">{group.title}</h2>
          <p className="text-sm text-brand-muted">{group.detail}</p>
        </div>
        <p className="text-xs font-semibold tabular-nums text-brand-dim">
          {group.total > group.items.length ? `${group.items.length} of ${group.total}` : group.total}
        </p>
      </div>
      <ul className="divide-y divide-brand-border">
        {rows.map((entry) => <QueueRow key={`${group.key}-${entry.id}`} entry={entry} onOpen={onOpen} />)}
      </ul>
      {(hidden > 0 || expanded) && group.items.length > QUEUE_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex min-h-11 w-full items-center justify-center border-t border-brand-border text-sm font-semibold text-accent-ink hover:bg-brand-bg"
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </section>
  )
}

function QueueRow({ entry, onOpen }: { entry: QueueItem; onOpen: (id: string) => void }) {
  const callable = Boolean(entry.phone) && entry.kind !== 'onboarding'
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-bg sm:px-5">
      <button type="button" onClick={() => onOpen(entry.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${entry.urgent ? 'bg-brand-text text-white' : 'bg-accent-soft text-brand-text'}`}
          aria-hidden
        >
          {entry.business.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-brand-text">{entry.business}</span>
          <span className={`block truncate text-xs ${entry.urgent ? 'font-semibold text-brand-red' : 'text-brand-muted'}`}>
            {entry.reason}
          </span>
          <span className="block truncate text-xs text-brand-dim sm:hidden">
            {[entry.contactName, STAGE_LABELS[entry.stage]].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-xs text-brand-dim sm:block">
          <span className="block">{entry.contactName || 'No contact'}</span>
          <span className="block">{STAGE_LABELS[entry.stage]}</span>
        </span>
      </button>
      {callable ? (
        <a
          href={`tel:${entry.phone}`}
          onClick={() => onOpen(entry.id)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-brand-text px-4 text-sm font-semibold text-white hover:opacity-90"
          aria-label={`Call ${entry.business}`}
        >
          Call
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(entry.id)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white px-4 text-sm font-semibold text-brand-text hover:border-accent"
        >
          Open
        </button>
      )}
    </li>
  )
}

// ---------- Clients ----------

const HEALTH_LABEL: Record<ClientAccount['health'], string> = {
  at_risk: 'At risk',
  attention: 'Needs attention',
  on_track: 'On track',
}

function HealthDot({ health }: { health: ClientAccount['health'] }) {
  const color = health === 'at_risk' ? 'bg-brand-red' : health === 'attention' ? 'bg-accent' : 'bg-brand-green'
  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-label={HEALTH_LABEL[health]} />
}

function ClientsView({ accounts, role, onOpen }: { accounts: ClientAccount[]; role: string; onOpen: (id: string) => void }) {
  const counts = {
    at_risk: accounts.filter((a) => a.health === 'at_risk').length,
    attention: accounts.filter((a) => a.health === 'attention').length,
    on_track: accounts.filter((a) => a.health === 'on_track').length,
  }
  const mrr = accounts.reduce((sum, account) => sum + account.monthly, 0)
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-brand-text">Client accounts</h2>
          <p className="text-sm text-brand-muted">
            {accounts.length} active · {counts.at_risk} at risk · {counts.attention} need attention · {money(mrr)}/mo on file
          </p>
        </div>
        {(role === 'admin' || role === 'client_relations') && (
          <Link href="/admin/clients" className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-border bg-white px-5 text-sm font-semibold text-brand-text hover:border-accent">
            Manage client records
          </Link>
        )}
      </div>
      {accounts.length === 0 ? (
        <div className={`${card} p-6`}>
          <p className="font-serif text-xl text-brand-text">No active clients yet.</p>
          <p className="mt-1 text-sm text-brand-muted">When a lead reaches Active client, its account shows up here with onboarding, deadlines, and billing.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <li key={account.id} className={`${card} hover-lift flex flex-col p-5`}>
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onOpen(account.id)} className="min-w-0 text-left">
                  <span className="block truncate font-serif text-lg text-brand-text">{account.business}</span>
                  <span className="block truncate text-sm text-brand-muted">{account.contactName || 'No contact'}</span>
                </button>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  account.health === 'at_risk' ? 'bg-red-50 text-brand-red' : account.health === 'attention' ? 'bg-accent-soft text-brand-text' : 'bg-emerald-50 text-brand-green'
                }`}>
                  {HEALTH_LABEL[account.health]}
                </span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-brand-muted">
                  <span>Onboarding</span>
                  <span className="tabular-nums">{account.onboardingDone} / {account.onboardingTotal}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-bg-soft">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(account.onboardingDone / account.onboardingTotal) * 100}%` }} />
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-brand-dim">Billing</dt>
                  <dd className="font-semibold text-brand-text">{account.billing}{account.monthly ? ` · ${money(account.monthly)}/mo` : ''}</dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-dim">Tasks</dt>
                  <dd className="font-semibold text-brand-text">
                    {account.openTasks} open{account.overdueTasks ? <span className="text-brand-red"> · {account.overdueTasks} late</span> : ''}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-brand-dim">Next</dt>
                  <dd className="truncate text-brand-text">
                    {account.nextTask ? `${account.nextTask.title} · ${account.nextTask.dueDate}` : account.deadline ? `Deadline: ${account.deadline}` : 'Nothing scheduled'}
                  </dd>
                </div>
              </dl>
              {account.reasons.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {account.reasons.slice(0, 3).map((reason) => (
                    <li key={reason} className="flex gap-2 text-xs text-brand-muted"><span aria-hidden>·</span>{reason}</li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <button type="button" onClick={() => onOpen(account.id)} className="inline-flex min-h-11 items-center rounded-full bg-brand-text px-4 text-sm font-semibold text-white">
                  Open
                </button>
                {account.clientId && (role === 'admin' || role === 'client_relations' || role === 'sales_closer') && (
                  <Link href={`/admin/clients?client=${account.clientId}`} className="inline-flex min-h-11 items-center rounded-full border border-brand-border px-4 text-sm font-semibold text-brand-text hover:border-accent">
                    Client record
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Insights ----------

function InsightsView({ insights, kpis }: { insights: WorkspaceInsights; kpis: MarketingKpiView }) {
  const top = Math.max(1, insights.funnel[0]?.count || 0)
  const busiest = Math.max(1, ...insights.activity.map((day) => day.calls))
  const tiles = [
    { label: 'Response rate', value: kpis.responseRate, detail: `${kpis.responsesRecorded} replies of ${kpis.emailsSent} emails` },
    { label: 'Consultations', value: String(kpis.consultationsBooked), detail: 'Saved consultation dates' },
    { label: 'Close rate', value: kpis.closeRate, detail: `${kpis.closed} of ${kpis.leadVolume} leads` },
    { label: 'Paid revenue', value: kpis.revenue, detail: 'Monthly, paid marketing clients' },
    { label: 'Cost per lead', value: kpis.costPerLead, detail: 'Needs ad spend connected' },
  ]
  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.label} className={`${card} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">{tile.label}</p>
            <p className="mt-1 font-serif text-2xl text-brand-text">{tile.value}</p>
            <p className="mt-0.5 text-xs text-brand-muted">{tile.detail}</p>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={`${card} p-4 sm:p-5`}>
          <p className={kicker}>Funnel</p>
          <h2 className="mt-1 font-serif text-xl text-brand-text">Where leads stop</h2>
          <ol className="mt-4 space-y-3">
            {insights.funnel.map((step) => (
              <li key={step.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-brand-text">{step.label}</span>
                  <span className="tabular-nums text-brand-muted">
                    <span className="font-semibold text-brand-text">{step.count}</span>
                    {step.rate && <span className="ml-2 text-xs">{step.rate} of previous</span>}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-brand-bg-soft">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(step.count > 0 ? 1.5 : 0, (step.count / top) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${card} p-4 sm:p-5`}>
          <p className={kicker}>Activity</p>
          <h2 className="mt-1 font-serif text-xl text-brand-text">Calls, last 14 days</h2>
          <div className="mt-4 flex h-36 items-end gap-1" role="img" aria-label="Calls logged per day for the last 14 days">
            {insights.activity.map((day) => (
              <div key={day.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${day.day}: ${day.calls} calls, ${day.conversations} conversations`}>
                <div className="flex flex-col justify-end overflow-hidden rounded-t-md bg-brand-bg-soft" style={{ height: `${(day.calls / busiest) * 100}%`, minHeight: day.calls ? 4 : 2 }}>
                  <div className="bg-accent" style={{ height: day.calls ? `${(day.conversations / day.calls) * 100}%` : 0 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-brand-dim">
            <span>{insights.activity[0]?.day.slice(5)}</span>
            <span>Today</span>
          </div>
          <p className="mt-3 flex flex-wrap gap-4 text-xs text-brand-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-bg-soft ring-1 ring-brand-border" aria-hidden />Calls</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden />Conversations</span>
            <span>{insights.activity.reduce((sum, day) => sum + day.calls, 0)} calls · {insights.activity.reduce((sum, day) => sum + day.conversations, 0)} conversations</span>
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <SegmentTable title="By source" rows={insights.sources} />
        <SegmentTable title="By industry" rows={insights.industries} />
        <SegmentTable title="By score" rows={insights.scoreBands} />
      </div>
    </div>
  )
}

function SegmentTable({ title, rows }: { title: string; rows: WorkspaceInsights['sources'] }) {
  return (
    <section className={`${card} min-w-0 p-4 sm:p-5`}>
      <p className={kicker}>Performance</p>
      <h2 className="mt-1 font-serif text-xl text-brand-text">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-brand-dim">
              <th scope="col" className="py-2 pr-2 font-semibold">Segment</th>
              <th scope="col" className="py-2 px-1 text-right font-semibold">Leads</th>
              <th scope="col" className="py-2 px-1 text-right font-semibold">Reached</th>
              <th scope="col" className="py-2 px-1 text-right font-semibold">Offers</th>
              <th scope="col" className="py-2 pl-1 text-right font-semibold">Won</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="max-w-[10rem] truncate py-2 pr-2 text-left font-medium text-brand-text">{row.label}</th>
                <td className="py-2 px-1 text-right tabular-nums text-brand-text">{row.total}</td>
                <td className="py-2 px-1 text-right tabular-nums text-brand-muted">{row.total ? `${Math.round((row.reached / row.total) * 100)}%` : '—'}</td>
                <td className="py-2 px-1 text-right tabular-nums text-brand-muted">{row.offers}</td>
                <td className="py-2 pl-1 text-right tabular-nums text-brand-muted">{row.won}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
