'use client'

import { useEffect, useState } from 'react'
import { disputeSessionsTiedToApplication } from '@/lib/dispute-letters/tied-sessions'

type SessionRow = {
  id: string
  file_name: string
  status: string
  created_at: string
  application_uuid?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  uploaded: 'Uploaded',
  analyzing: 'Analyzing',
  ready: 'Ready',
  failed: 'Failed',
}

export default function CreditClientHistory({
  applicationId,
  onOpen,
}: {
  applicationId: string
  onOpen: (sessionId: string) => void
}) {
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/dispute-letters/by-application?applicationUuid=${encodeURIComponent(applicationId)}`
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load history')
        const tied = disputeSessionsTiedToApplication<SessionRow>(
          Array.isArray(data.sessions) ? data.sessions : [],
          applicationId
        )
        if (!cancelled) setRows(tied)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load history')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applicationId])

  if (error) return <p className="text-sm text-brand-red">{error}</p>
  if (!rows) return <p className="text-sm text-brand-dim">Loading history…</p>
  if (rows.length === 0) {
    return <p className="text-sm text-brand-muted">No dispute sessions are tied to this client.</p>
  }

  return (
    <ul className="space-y-2">
      {rows.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            onClick={() => onOpen(session.id)}
            className="flex w-full items-start justify-between gap-3 rounded-2xl border border-brand-border bg-white px-3.5 py-3 text-left hover:ring-2 hover:ring-accent"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-brand-text">{session.file_name}</span>
              <span className="mt-0.5 block text-xs text-brand-muted">
                {new Date(session.created_at).toLocaleString()}
              </span>
            </span>
            <span className="shrink-0 rounded-md bg-accent-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-text">
              {STATUS_LABEL[session.status] || session.status}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
