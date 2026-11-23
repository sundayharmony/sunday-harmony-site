'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import CreditDrawer, { type DrawerStep } from '@/components/admin/credit/CreditDrawer'
import { STATUS_LABELS } from '@/lib/credit-funding-types'
import {
  DESK_PHASES,
  PHASE_DETAIL,
  PHASE_LABELS,
  clientPhase,
  clientWaitingOnUs,
  feeOwed,
  money,
  openRound,
  type CreditInsights,
  type CreditPulse,
  type CreditQueueGroup,
  type CreditQueueItem,
  type DeskClient,
  type DeskPhase,
  type RoundRow,
} from '@/lib/credit-desk'

/**
 * The Credit desk. Like the marketing Growth desk: a pulse bar of phases that
 * filters the client board, one drawer that opens from every view, and view,
 * phase, and open client kept in the URL. The full application file stays at
 * /admin/credit-funding?id=… for documents, analysis, and letters.
 */

type DeskPayload = {
  role: string
  experts: { id: string; name: string; email: string }[]
  clients: DeskClient[]
  queue: CreditQueueGroup[]
  pulse: CreditPulse
  rounds: RoundRow[]
  insights: CreditInsights
}

const VIEWS = [
  { id: 'today', label: 'Today' },
  { id: 'clients', label: 'Clients' },
  { id: 'rounds', label: 'Rounds' },
  { id: 'insights', label: 'Insights' },
] as const
type ViewId = (typeof VIEWS)[number]['id']

const kicker = 'text-[11px] font-bold uppercase tracking-[0.14em] text-accent-ink'
const card = 'rounded-[22px] border border-brand-border bg-white'
const pillOutline = 'inline-flex min-h-11 items-center justify-center rounded-full border border-brand-border bg-white px-5 text-sm font-semibold text-brand-text hover:border-accent'

function isPhase(value: string | null): value is DeskPhase {
  return DESK_PHASES.includes(value as DeskPhase)
}

export default function CreditDesk() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [data, setData] = useState<DeskPayload | null>(null)
  const [error, setError] = useState('')
  const [sequence, setSequence] = useState<DrawerStep[]>([])
  const reloadTimer = useRef<number | null>(null)

  const requested = params.get('view')
  const view: ViewId = VIEWS.some((item) => item.id === requested) ? (requested as ViewId) : 'today'
  const phaseParam = params.get('phase')
  const phase: DeskPhase | '' = isPhase(phaseParam) ? phaseParam : ''
  const clientId = params.get('client')

  const setQuery = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [params, pathname, router])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/credit-funding/desk')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not load the credit desk')
      setData(body)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the credit desk')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const changed = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current)
    reloadTimer.current = window.setTimeout(() => void load(), 600)
  }, [load])

  const queueSequence = useMemo<DrawerStep[]>(
    () => (data?.queue || []).flatMap((group) => group.items.map((item) => ({ id: item.id, name: item.name }))),
    [data]
  )
  const openClient = useCallback((id: string) => setQuery({ client: id }), [setQuery])
  const openFromQueue = useCallback((id: string) => {
    setSequence(queueSequence)
    openClient(id)
  }, [openClient, queueSequence])
  const openSingle = useCallback((id: string) => {
    setSequence([])
    openClient(id)
  }, [openClient])
  const closeClient = useCallback(() => setQuery({ client: null }), [setQuery])

  const selected = data?.clients.find((client) => client.id === clientId) || null
  const role = data?.role || ''

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className={kicker}>Credit &amp; Funding</p>
          <h1 className="mt-1 font-serif text-3xl text-brand-text sm:text-4xl">Credit desk</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">
            {role === 'credit_manager'
              ? 'Your assigned clients: replies, letters to mail, bureau deadlines, and what is next.'
              : 'Every credit and funding client, from intake through dispute rounds to funding.'}
          </p>
        </div>
        <Link href="/admin/credit-funding?files=1" className={pillOutline}>All applications</Link>
      </header>

      {error && <p className="text-sm text-brand-red">{error}</p>}

      <PulseBar pulse={data?.pulse || null} active={view === 'clients' ? phase : ''} onPhase={(next) => setQuery({ view: 'clients', phase: next === phase && view === 'clients' ? null : next })} />

      <nav aria-label="Credit views" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-max gap-1 rounded-full border border-brand-border bg-white p-1">
          {VIEWS.map((item) => {
            const active = item.id === view
            const badge = item.id === 'today'
              ? (data?.queue || []).filter((group) => ['client_waiting', 'deadline_passed', 'letters_ready'].includes(group.key)).reduce((sum, group) => sum + group.total, 0)
              : item.id === 'rounds' ? data?.pulse.deadlinesThisWeek || 0 : 0
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setQuery({ view: item.id === 'today' ? null : item.id, phase: item.id === 'clients' ? phase || null : null })}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${active ? 'bg-brand-text text-white' : 'text-brand-muted hover:text-brand-text'}`}
              >
                {item.label}
                {badge > 0 && (
                  <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-accent text-brand-text' : 'bg-accent-soft text-brand-text'}`}>{badge}</span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {!data && !error && <p className="text-sm text-brand-muted">Loading the desk…</p>}
      {data && view === 'today' && <TodayView data={data} onOpen={openFromQueue} onOpenSingle={openSingle} onView={(next) => setQuery({ view: next })} />}
      {data && view === 'clients' && <ClientsBoard clients={data.clients} phase={phase} onOpen={openSingle} />}
      {data && view === 'rounds' && <RoundsView rounds={data.rounds} onOpen={openSingle} />}
      {data && view === 'insights' && <InsightsView insights={data.insights} pulse={data.pulse} />}

      <CreditDrawer
        client={selected}
        role={role}
        experts={data?.experts || []}
        sequence={sequence}
        onClose={closeClient}
        onOpen={openClient}
        onChanged={changed}
      />
    </div>
  )
}

// ---------- Pulse ----------

function PulseBar({ pulse, active, onPhase }: { pulse: CreditPulse | null; active: DeskPhase | ''; onPhase: (phase: DeskPhase) => void }) {
  if (!pulse) return <div className={`${card} h-[132px] animate-pulse bg-brand-bg-soft`} aria-hidden />
  return (
    <section aria-label="Credit pulse" className={`${card} overflow-hidden`}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-x-auto border-b border-brand-border lg:border-b-0 lg:border-r">
          <ol className="flex min-w-max">
            {pulse.phases.map((row, index) => {
              const on = row.phase === active
              return (
                <li key={row.phase}>
                  <button
                    type="button"
                    onClick={() => onPhase(row.phase)}
                    aria-pressed={on}
                    title={`Show ${row.label} clients`}
                    className={`group relative flex h-full min-w-[120px] flex-col items-start gap-0.5 px-4 py-4 text-left transition sm:min-w-[136px] ${on ? 'bg-accent-soft' : 'hover:bg-brand-bg'}`}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">{row.label}</span>
                    <span className="font-serif text-3xl tabular-nums text-brand-text">{row.count}</span>
                    <span className="text-xs text-brand-muted">{row.count === 1 ? 'client' : 'clients'}</span>
                    {index < pulse.phases.length - 2 && <span className="absolute right-0 top-1/2 -translate-y-1/2 text-brand-border" aria-hidden>›</span>}
                    <span className={`absolute inset-x-4 bottom-0 h-[3px] rounded-full transition ${on ? 'bg-accent' : 'bg-transparent group-hover:bg-brand-border'}`} aria-hidden />
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
        <dl className="grid grid-cols-2 gap-2 px-4 py-4 sm:px-5">
          <PulseStat label="Letters to mail" value={String(pulse.lettersToMail)} highlight={pulse.lettersToMail > 0} />
          <PulseStat label="Deadlines ≤ 7 days" value={String(pulse.deadlinesThisWeek)} highlight={pulse.deadlinesThisWeek > 0} />
          <PulseStat label="Fees collected" value={money(pulse.feesCollectedCents)} />
          <PulseStat label="Fees owed" value={money(pulse.feesOwedCents)} highlight={pulse.feesOwedCents > 0} />
        </dl>
      </div>
    </section>
  )
}

function PulseStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${highlight ? 'bg-accent-soft' : 'bg-brand-bg'}`}>
      <dd className="text-lg font-semibold tabular-nums text-brand-text">{value}</dd>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-brand-dim">{label}</dt>
    </div>
  )
}

// ---------- Today ----------

function TodayView({ data, onOpen, onOpenSingle, onView }: { data: DeskPayload; onOpen: (id: string) => void; onOpenSingle: (id: string) => void; onView: (view: ViewId) => void }) {
  const upcoming = data.rounds.filter((round) => round.status !== 'letters_ready').slice(0, 5)
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        {data.queue.length === 0 ? (
          <div className={`${card} p-6`}>
            <p className="font-serif text-xl text-brand-text">Nothing waiting on you.</p>
            <p className="mt-1 text-sm text-brand-muted">No replies, letters to mail, or deadlines are due. Check the rounds tracker for what is coming.</p>
          </div>
        ) : (
          data.queue.map((group) => <QueueSection key={group.key} group={group} onOpen={onOpen} />)
        )}
      </div>
      <aside className="min-w-0 space-y-5">
        <section className={`${card} p-4 sm:p-5`}>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className={kicker}>Bureau clock</p>
              <h2 className="mt-1 font-serif text-xl text-brand-text">Next deadlines</h2>
            </div>
            <button type="button" onClick={() => onView('rounds')} className="text-sm font-semibold text-accent-ink hover:underline">All</button>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted">No rounds are out with the bureaus.</p>
          ) : (
            <ul className="mt-3 divide-y divide-brand-border">
              {upcoming.map((round) => (
                <li key={round.id}>
                  <button type="button" onClick={() => onOpenSingle(round.clientUuid)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-brand-text">{round.name}</span>
                      <span className="block text-xs text-brand-muted">Round {round.roundNumber} · {round.label}</span>
                    </span>
                    <DaysLeft days={round.daysLeft} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${card} p-4 sm:p-5`}>
          <p className={kicker}>How the queue works</p>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Client replies first, then passed bureau deadlines and letters waiting to be mailed, then new reviews, deadlines this week, missing documents, unpaid fees, and stale invites.
            The bureaus have 30 days to answer once letters are delivered, so the clock comes from each round&apos;s deadline.
          </p>
        </section>
      </aside>
    </div>
  )
}

function DaysLeft({ days }: { days: number | null }) {
  if (days == null) return <span className="shrink-0 text-xs text-brand-dim">No date</span>
  const late = days < 0
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${late ? 'bg-red-50 text-brand-red' : days <= 7 ? 'bg-accent-soft text-brand-text' : 'bg-brand-bg text-brand-muted'}`}>
      {late ? `${-days}d late` : days === 0 ? 'Today' : `${days}d left`}
    </span>
  )
}

const QUEUE_PREVIEW = 5

function QueueSection({ group, onOpen }: { group: CreditQueueGroup; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? group.items : group.items.slice(0, QUEUE_PREVIEW)
  return (
    <section className={`${card} overflow-hidden`} aria-labelledby={`cq-${group.key}`}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-brand-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 id={`cq-${group.key}`} className="font-serif text-xl text-brand-text">{group.title}</h2>
          <p className="text-sm text-brand-muted">{group.detail}</p>
        </div>
        <p className="text-xs font-semibold tabular-nums text-brand-dim">{group.total}</p>
      </div>
      <ul className="divide-y divide-brand-border">
        {rows.map((item) => <QueueRow key={`${group.key}-${item.id}`} item={item} onOpen={onOpen} />)}
      </ul>
      {group.items.length > QUEUE_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex min-h-11 w-full items-center justify-center border-t border-brand-border text-sm font-semibold text-accent-ink hover:bg-brand-bg"
        >
          {expanded ? 'Show fewer' : `Show ${group.items.length - QUEUE_PREVIEW} more`}
        </button>
      )}
    </section>
  )
}

function QueueRow({ item, onOpen }: { item: CreditQueueItem; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(item.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-bg sm:px-5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${item.urgent ? 'bg-brand-text text-white' : 'bg-accent-soft text-brand-text'}`} aria-hidden>
          {item.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-brand-text">{item.name}</span>
          <span className={`block truncate text-xs ${item.urgent ? 'font-semibold text-brand-red' : 'text-brand-muted'}`}>{item.reason}</span>
          <span className="block truncate text-xs text-brand-dim sm:hidden">{STATUS_LABELS[item.status]}{item.unassigned ? ' · No expert' : ''}</span>
        </span>
        <span className="hidden shrink-0 text-right text-xs text-brand-dim sm:block">
          <span className="block">{STATUS_LABELS[item.status]}</span>
          <span className="block">{item.unassigned ? 'No expert assigned' : item.applicationId}</span>
        </span>
        <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-white px-4 text-sm font-semibold text-brand-text">Open</span>
      </button>
    </li>
  )
}

// ---------- Clients board ----------

function ClientsBoard({ clients, phase, onOpen }: { clients: DeskClient[]; phase: DeskPhase | ''; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const visible = clients.filter((client) => !needle || [client.name, client.email, client.applicationId].some((value) => value.toLowerCase().includes(needle)))
  const phases = phase ? [phase] : DESK_PHASES.filter((value) => value !== 'done')
  const doneCount = visible.filter((client) => clientPhase(client) === 'done').length
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="block min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search clients</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or application ID" className="w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm" />
        </label>
        {!phase && doneCount > 0 && <p className="text-xs text-brand-muted">{doneCount} done clients hidden. Click Done in the bar above to see them.</p>}
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-2">
        {phases.map((value) => {
          const rows = visible.filter((client) => clientPhase(client) === value)
          return (
            <section key={value} className={`flex min-w-0 flex-col rounded-[22px] border border-brand-border bg-brand-bg-soft/60 ${phase ? 'w-full' : 'md:w-[280px] md:shrink-0'}`} aria-labelledby={`phase-${value}`}>
              <div className="border-b border-brand-border px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id={`phase-${value}`} className="font-serif text-lg text-brand-text">{PHASE_LABELS[value]}</h2>
                  <span className="text-xs font-semibold tabular-nums text-brand-dim">{rows.length}</span>
                </div>
                <p className="text-xs text-brand-muted">{PHASE_DETAIL[value]}</p>
              </div>
              {/* One stage picked: spread its clients across the full width instead of one skinny column. */}
              <ul className={phase ? 'grid grid-cols-1 gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' : 'max-h-[min(70vh,40rem)] space-y-2 overflow-y-auto p-2'}>
                {rows.length === 0 ? <li className="px-2 py-3 text-sm text-brand-muted">None.</li> : rows.map((client) => <ClientCard key={client.id} client={client} onOpen={onOpen} />)}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function ClientCard({ client, onOpen }: { client: DeskClient; onOpen: (id: string) => void }) {
  const round = openRound(client)
  const flags = [
    clientWaitingOnUs(client) ? 'Waiting on our reply' : '',
    feeOwed(client) ? `${money(client.feeCents)} unpaid` : '',
    !client.assignedSpecialist ? 'No expert' : '',
  ].filter(Boolean)
  return (
    <li>
      <button type="button" onClick={() => onOpen(client.id)} className="hover-lift w-full rounded-2xl border border-brand-border bg-white px-3 py-3 text-left">
        <span className="block truncate text-sm font-semibold text-brand-text">{client.name || 'Unnamed client'}</span>
        <span className="mt-0.5 block truncate text-xs text-brand-muted">{STATUS_LABELS[client.status]}</span>
        {round && <span className="mt-1 block text-xs text-brand-dim">Round {round.roundNumber} · {round.status.replace(/_/g, ' ')}</span>}
        {flags.length > 0 && <span className="mt-1.5 block truncate text-xs font-semibold text-accent-ink">{flags.join(' · ')}</span>}
      </button>
    </li>
  )
}

// ---------- Rounds ----------

function RoundsView({ rounds, onOpen }: { rounds: RoundRow[]; onOpen: (id: string) => void }) {
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="border-b border-brand-border px-4 py-4 sm:px-5">
        <h2 className="font-serif text-2xl text-brand-text">Open dispute rounds</h2>
        <p className="text-sm text-brand-muted">Past deadlines first, then letters to mail, then the soonest responses.</p>
      </div>
      {rounds.length === 0 ? (
        <p className="px-5 py-6 text-sm text-brand-muted">No open rounds.</p>
      ) : (
        <ul className="divide-y divide-brand-border">
          {rounds.map((round) => (
            <li key={round.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <button type="button" onClick={() => onOpen(round.clientUuid)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif text-sm text-brand-text" aria-label={`Round ${round.roundNumber}`}>R{round.roundNumber}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-brand-text">{round.name}</span>
                  <span className="block truncate text-xs text-brand-muted">
                    {round.label}{round.mailedAt ? ` · mailed ${new Date(round.mailedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </span>
                </span>
                <DaysLeft days={round.status === 'letters_ready' ? null : round.daysLeft} />
              </button>
              {round.sessionId && (
                <Link href={`/admin/dispute-letters/${round.sessionId}/letters`} className="hidden shrink-0 text-sm font-semibold text-accent-ink hover:underline sm:inline">Letters</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------- Insights ----------

function InsightsView({ insights, pulse }: { insights: CreditInsights; pulse: CreditPulse }) {
  const maxOutcome = Math.max(1, ...insights.outcomes.map((row) => row.count))
  const fees = insights.feeCollection
  const feeTotal = Math.max(1, fees.paid + fees.owed + fees.notSet)
  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Removal rate', value: insights.resolvedRate, detail: 'Deleted or updated, of items the bureaus answered' },
          { label: 'Items in dispute', value: String(pulse.itemsInDispute), detail: 'Disputed or queued for a round' },
          { label: 'Fees collected', value: money(pulse.feesCollectedCents), detail: `${fees.paid} paid` },
          { label: 'Fees owed', value: money(pulse.feesOwedCents), detail: `${fees.owed} unpaid · ${fees.notSet} not set` },
        ].map((tile) => (
          <li key={tile.label} className={`${card} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dim">{tile.label}</p>
            <p className="mt-1 font-serif text-2xl text-brand-text">{tile.value}</p>
            <p className="mt-0.5 text-xs text-brand-muted">{tile.detail}</p>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={`${card} p-4 sm:p-5`}>
          <p className={kicker}>Dispute items</p>
          <h2 className="mt-1 font-serif text-xl text-brand-text">Where every item stands</h2>
          <ul className="mt-4 space-y-3">
            {insights.outcomes.map((row) => (
              <li key={row.key}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-brand-text">{row.label}</span>
                  <span className="font-semibold tabular-nums text-brand-text">{row.count}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-bg-soft">
                  <div className={`h-full rounded-full ${row.key === 'deleted' || row.key === 'updated' ? 'bg-brand-green' : 'bg-accent'}`} style={{ width: `${(row.count / maxOutcome) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <div className="space-y-5">
          <section className={`${card} p-4 sm:p-5`}>
            <p className={kicker}>Rounds</p>
            <h2 className="mt-1 font-serif text-xl text-brand-text">By round number</h2>
            {insights.roundsByNumber.length === 0 ? <p className="mt-3 text-sm text-brand-muted">No rounds yet.</p> : (
              <table className="mt-3 w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-brand-dim"><th scope="col" className="py-1.5 font-semibold">Round</th><th scope="col" className="py-1.5 text-right font-semibold">Open</th><th scope="col" className="py-1.5 text-right font-semibold">Closed</th></tr></thead>
                <tbody className="divide-y divide-brand-border">
                  {insights.roundsByNumber.map((row) => (
                    <tr key={row.round}><th scope="row" className="py-2 text-left font-medium text-brand-text">Round {row.round}</th><td className="py-2 text-right tabular-nums">{row.open}</td><td className="py-2 text-right tabular-nums text-brand-muted">{row.closed}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className={`${card} p-4 sm:p-5`}>
            <p className={kicker}>Repair fees</p>
            <h2 className="mt-1 font-serif text-xl text-brand-text">Collection</h2>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-brand-bg-soft" role="img" aria-label={`${fees.paid} paid, ${fees.owed} unpaid, ${fees.notSet} not set`}>
              <div className="bg-brand-green" style={{ width: `${(fees.paid / feeTotal) * 100}%` }} />
              <div className="bg-accent" style={{ width: `${(fees.owed / feeTotal) * 100}%` }} />
            </div>
            <p className="mt-2 flex flex-wrap gap-4 text-xs text-brand-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-green" aria-hidden />{fees.paid} paid</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden />{fees.owed} unpaid</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-bg-soft ring-1 ring-brand-border" aria-hidden />{fees.notSet} not set</span>
            </p>
            <p className="mt-4 text-sm text-brand-muted">Clients by service: {insights.services.map((row) => `${row.label} ${row.count}`).join(' · ') || 'none'}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
