'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'

export type CreditAttentionApplication = {
  personId: string
  name: string
  email: string
  status: string
  applicationId: string
}

export function CreditAttentionList({ applications }: { applications: CreditAttentionApplication[] }) {
  if (applications.length === 0) {
    return <p className="text-sm text-brand-muted">Nothing needs action.</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {applications.map((app) => (
        <li key={app.applicationId || app.personId}>
          <Link
            href={`/admin/credit-funding?id=${encodeURIComponent(app.applicationId)}`}
            className="flex overflow-hidden rounded-2xl bg-white text-left shadow-[0_12px_28px_-18px_rgba(10,10,10,0.55)] hover:ring-2 hover:ring-accent"
          >
            <span className="w-[3px] shrink-0 bg-accent" aria-hidden />
            <span className="flex min-w-0 flex-1 items-start justify-between gap-3 px-3.5 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-brand-text">{app.name}</span>
                <span className="mt-0.5 block truncate text-xs text-brand-muted">{app.email}</span>
              </span>
              <StatusBadge status={app.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function CreditAttentionHome() {
  const [applications, setApplications] = useState<CreditAttentionApplication[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/admin/today?scope=credit')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load what needs action.')
        if (!cancelled) setApplications(Array.isArray(data.applications) ? data.applications : [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load what needs action.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-sm font-semibold text-brand-text">Needs action</h2>
      {error ? (
        <p className="text-sm text-brand-red">{error}</p>
      ) : !applications ? (
        <p className="text-sm text-brand-dim">Loading…</p>
      ) : (
        <CreditAttentionList applications={applications} />
      )}
    </section>
  )
}
