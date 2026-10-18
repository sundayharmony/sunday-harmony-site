'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { TodayQueue } from '@/lib/people'

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function QueueCard({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
      <h2 className="text-sm font-bold text-brand-text mb-3">{title}</h2>
      {children || <p className="text-sm text-brand-muted">{empty}</p>}
    </section>
  )
}

function Row({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-transparent px-2 py-2 -mx-2 hover:bg-neutral-50 hover:border-brand-border"
    >
      <div className="text-sm font-medium text-brand-text">{title}</div>
      <div className="text-xs text-brand-muted">{detail}</div>
    </Link>
  )
}

export default function TodayBoard() {
  const [queue, setQueue] = useState<TodayQueue | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/today')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Could not load today.')
          return
        }
        setQueue(data)
      } catch {
        setError('Could not load today.')
      }
    })()
  }, [])

  if (error) return <p className="text-sm text-brand-red">{error}</p>
  if (!queue) return <p className="text-sm text-brand-muted">Loading today…</p>

  const creditOnly = queue.role === 'credit_manager'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Today</h1>
        <p className="text-sm text-brand-muted">
          {creditOnly
            ? 'Credit and funding applications waiting on you.'
            : 'Consultations coming up, applications waiting, people who owe money, and referral payouts ready to send.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!creditOnly && (
          <QueueCard title="Consultations" empty="No consultations in the next 7 days.">
            {queue.consultations.length > 0 && (
              <div className="space-y-1">
                {queue.consultations.map((row) => (
                  <Row
                    key={row.bookingId}
                    href={`/admin/people/${row.personId}`}
                    title={row.name}
                    detail={`${formatWhen(row.startsAt)} ET${row.email ? ` · ${row.email}` : ''}`}
                  />
                ))}
              </div>
            )}
          </QueueCard>
        )}

        <QueueCard title="Applications waiting" empty="Nothing is waiting on review.">
          {queue.applications.length > 0 && (
            <div className="space-y-1">
              {queue.applications.map((row) => (
                <Row
                  key={row.applicationId}
                  href={`/admin/people/${row.personId}`}
                  title={row.name}
                  detail={`${row.status.replace(/_/g, ' ')}${row.email ? ` · ${row.email}` : ''}`}
                />
              ))}
            </div>
          )}
        </QueueCard>

        {!creditOnly && (
          <QueueCard title="Who owes money" empty="Nobody has an open balance.">
            {queue.owes.length > 0 && (
              <div className="space-y-1">
                {queue.owes.map((row) => (
                  <Row
                    key={row.personId}
                    href={`/admin/people/${row.personId}`}
                    title={row.name}
                    detail={`${row.oweLabel}${row.email ? ` · ${row.email}` : ''}`}
                  />
                ))}
              </div>
            )}
          </QueueCard>
        )}

        {!creditOnly && (
          <QueueCard title="Referral payouts" empty="No commissions are ready to pay.">
            {queue.referrals.length > 0 && (
              <div className="space-y-1">
                {queue.referrals.map((row) => (
                  <Row
                    key={row.clientId}
                    href={`/admin/people/${row.personId}`}
                    title={row.name}
                    detail={`${formatCents(row.availableCents)} ready${row.email ? ` · ${row.email}` : ''}`}
                  />
                ))}
              </div>
            )}
          </QueueCard>
        )}
      </div>
    </div>
  )
}
