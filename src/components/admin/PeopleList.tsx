'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  groupPeopleByLane,
  personMatchesFilter,
  sortPeople,
  summarizePeople,
  type PeopleFilter,
  type PeopleLane,
  type PeopleSort,
  type PersonScope,
  type PersonSummary,
} from '@/lib/people'
import StatusBadge from '@/components/ui/StatusBadge'

const LANE_LABEL: Record<PeopleLane, string> = {
  owes: 'Owes money',
  waiting: 'Waiting on review',
  consultation: 'Consultations',
  credit: 'Credit & funding',
  completed: 'Completed',
  client: 'Clients',
  contact: 'Contacts',
}

function formatWhen(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function LanePanel({
  lane,
  people,
  scope,
}: {
  lane: PeopleLane
  people: PersonSummary[]
  scope: PersonScope
}) {
  return (
    <section
      className="flex flex-col min-h-[12rem] max-h-[min(72vh,36rem)] bg-white border border-brand-border rounded-xl shadow-sm overflow-hidden"
      aria-label={LANE_LABEL[lane]}
    >
      <header className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-brand-border bg-neutral-50/90">
        <h2 className="text-sm font-bold text-brand-text">{LANE_LABEL[lane]}</h2>
        <span className="text-xs font-semibold tabular-nums text-brand-dim bg-white border border-brand-border rounded-full px-2 py-0.5">
          {people.length}
        </span>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {people.length === 0 ? (
          <p className="text-xs text-brand-muted px-1 py-2">No one in this group.</p>
        ) : (
          people.map((person) => <PersonRow key={person.id} person={person} scope={scope} compact />)
        )}
      </div>
    </section>
  )
}

function PersonRow({
  person,
  scope,
  compact = false,
}: {
  person: PersonSummary
  scope: PersonScope
  compact?: boolean
}) {
  return (
    <Link
      href={`/admin/people/${person.id}`}
      className={`block bg-white border border-brand-border rounded-lg hover:border-accent transition-colors ${
        compact ? 'p-3' : 'rounded-xl p-4'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-bold text-brand-text truncate">{person.name}</div>
          <div className="text-xs text-brand-muted truncate">
            {[person.business, person.email, person.phone].filter(Boolean).join(' · ') || 'No contact details'}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {person.hasCreditWork && person.applicationStatus && (
            <StatusBadge status={person.applicationStatus} />
          )}
          {person.hasCreditWork && !person.applicationStatus && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-accent-soft text-brand-text">
              Credit
            </span>
          )}
          {person.owesMoney && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-red-50 text-brand-red">
              {person.oweLabel || 'Owes'}
            </span>
          )}
          {person.nextConsultationAt && scope === 'all' && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-neutral-100 text-brand-muted">
              {formatWhen(person.nextConsultationAt)} ET
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function PeopleList() {
  const [people, setPeople] = useState<PersonSummary[]>([])
  const [scope, setScope] = useState<PersonScope>('all')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PeopleFilter>('all')
  const [sort, setSort] = useState<PeopleSort>('newest')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/people')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (data?.code === 'SESSION_EXPIRED') return
          setError(typeof data.error === 'string' ? data.error : 'Could not load people.')
          return
        }
        setPeople(Array.isArray(data.people) ? data.people : [])
        setScope(data.scope === 'credit' ? 'credit' : 'all')
      } catch {
        setError('Could not load people.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const analytics = useMemo(() => summarizePeople(people, scope), [people, scope])
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? people.filter((person) =>
        [person.name, person.email, person.business, person.phone].some((value) =>
          (value || '').toLowerCase().includes(q)
        )
      )
      : people
    return matched.filter((person) => personMatchesFilter(person, filter, scope))
  }, [people, query, filter, scope])

  const groups = useMemo(
    () => (filter === 'all' ? groupPeopleByLane(searched, sort, scope) : []),
    [searched, sort, filter, scope]
  )
  const flat = useMemo(
    () => (filter === 'all' ? [] : sortPeople(searched, sort)),
    [searched, sort, filter]
  )

  const [leftGroups, rightGroups] = useMemo(() => {
    const left: typeof groups = []
    const right: typeof groups = []
    groups.forEach((group, index) => {
      if (index % 2 === 0) left.push(group)
      else right.push(group)
    })
    return [left, right]
  }, [groups])

  const cards: { id: PeopleFilter; label: string; value: number }[] = scope === 'credit'
    ? [
      { id: 'all', label: 'People', value: analytics.total },
      { id: 'owes', label: 'Owes', value: analytics.owes },
      { id: 'waiting', label: 'Waiting', value: analytics.waiting },
      { id: 'credit', label: 'Credit', value: analytics.credit },
      { id: 'completed', label: 'Completed', value: analytics.completed },
    ]
    : [
      { id: 'all', label: 'People', value: analytics.total },
      { id: 'owes', label: 'Owes', value: analytics.owes },
      { id: 'waiting', label: 'Waiting', value: analytics.waiting },
      { id: 'consultation', label: 'Consultations', value: analytics.consultations },
      { id: 'credit', label: 'Credit', value: analytics.credit },
      { id: 'completed', label: 'Completed', value: analytics.completed },
      { id: 'client', label: 'Clients', value: analytics.clients },
      { id: 'contact', label: 'Contacts', value: analytics.contacts },
    ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">People</h1>
        <p className="text-sm text-brand-muted">
          {scope === 'credit'
            ? 'Credit and funding clients, grouped by what needs attention.'
            : 'One person per email, grouped by what needs attention.'}
        </p>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
          {cards.filter((card) => card.id === 'all' || card.value > 0).map((card) => {
            const active = filter === card.id
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setFilter(active && card.id !== 'all' ? 'all' : card.id)}
                className={`text-left rounded-xl border px-3 py-3 transition-colors ${
                  active
                    ? 'bg-accent-soft border-accent'
                    : 'bg-white border-brand-border hover:border-accent'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim">{card.label}</div>
                <div className="text-2xl font-bold text-brand-text">{card.value}</div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, or business"
          className="flex-1 py-2.5 px-3 bg-white border border-brand-border rounded-lg text-sm text-brand-text outline-none focus:border-accent"
        />
        <label className="flex items-center gap-2 text-xs font-semibold text-brand-muted bg-white border border-brand-border rounded-lg px-3 py-2.5">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as PeopleSort)}
            className="bg-transparent text-sm font-medium text-brand-text outline-none"
          >
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="consultation">Consultation</option>
          </select>
        </label>
      </div>

      {loading && <p className="text-sm text-brand-muted">Loading people…</p>}
      {error && <p className="text-sm text-brand-red">{error}</p>}

      {!loading && !error && searched.length === 0 && (
        <div className="bg-white border border-brand-border rounded-xl p-6 text-sm text-brand-muted">
          {people.length === 0
            ? 'No people yet. A consultation, credit intake, or client account will show up here.'
            : 'No one matches that view.'}
        </div>
      )}

      {filter === 'all' && groups.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            {leftGroups.map((group) => (
              <LanePanel key={group.lane} lane={group.lane} people={group.people} scope={scope} />
            ))}
          </div>
          <div className="flex flex-col gap-4 min-w-0">
            {rightGroups.map((group) => (
              <LanePanel key={group.lane} lane={group.lane} people={group.people} scope={scope} />
            ))}
          </div>
        </div>
      ) : filter !== 'all' && flat.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="lg:col-span-2 max-w-3xl">
            <LanePanel
              lane={filter as PeopleLane}
              people={flat}
              scope={scope}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
