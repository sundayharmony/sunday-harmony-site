'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { PersonSummary } from '@/lib/people'

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

export default function PeopleList() {
  const [people, setPeople] = useState<PersonSummary[]>([])
  const [scope, setScope] = useState<'all' | 'credit'>('all')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/people')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter((person) =>
      [person.name, person.email, person.business, person.phone].some((value) =>
        (value || '').toLowerCase().includes(q)
      )
    )
  }, [people, query])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">People</h1>
        <p className="text-sm text-brand-muted">
          {scope === 'credit'
            ? 'Credit and funding clients. One row per person.'
            : 'One person per email. Open a file to see their consultation, credit work, billing, and messages.'}
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, email, or business"
        className="w-full mb-4 py-2.5 px-3 bg-white border border-brand-border rounded-lg text-sm text-brand-text outline-none focus:border-accent"
      />

      {loading && <p className="text-sm text-brand-muted">Loading people…</p>}
      {error && <p className="text-sm text-brand-red">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <div className="bg-white border border-brand-border rounded-xl p-6 text-sm text-brand-muted">
          {people.length === 0
            ? 'No people yet. A consultation, credit intake, or client account will show up here.'
            : 'No one matches that search.'}
        </div>
      )}

      <div className="space-y-2">
        {visible.map((person) => (
          <Link
            key={person.id}
            href={`/admin/people/${person.id}`}
            className="block bg-white border border-brand-border rounded-xl p-4 hover:border-accent transition-colors"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold text-brand-text truncate">{person.name}</div>
                <div className="text-xs text-brand-muted truncate">
                  {[person.business, person.email, person.phone].filter(Boolean).join(' · ') || 'No contact details'}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {person.hasCreditWork && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-accent-soft text-brand-text">
                    {person.applicationStatus?.replace(/_/g, ' ') || 'Credit'}
                  </span>
                )}
                {person.owesMoney && scope === 'all' && (
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
        ))}
      </div>
    </div>
  )
}
