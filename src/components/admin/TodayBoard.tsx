'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { STAGE_LABELS, type PipelineStage } from '@/lib/marketing-pipeline'

type MarketingToday = {
  kind: 'marketing'
  role: string
  followUps: { id: string; business: string; followUpAt: string | null; stage: PipelineStage }[]
  handoffs: { id: string; business: string; stage: PipelineStage; href: string }[]
  calendarEvents: { id: string; summary: string; start: string; htmlLink: string }[]
  metrics: { label: string; value: string }[]
  workspaceConnected: boolean
}

function formatWhen(iso: string | null): string {
  if (!iso) return ''
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

export default function TodayBoard() {
  const [board, setBoard] = useState<MarketingToday | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/today')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (data?.code === 'SESSION_EXPIRED') return
          setError(typeof data.error === 'string' ? data.error : 'Could not load today.')
          return
        }
        if (data.kind !== 'marketing') {
          setError('Open Credit & Funding for the credit queue.')
          return
        }
        setBoard(data)
      } catch {
        setError('Could not load today.')
      }
    })()
  }, [])

  if (error) return <p className="text-sm text-brand-red">{error}</p>
  if (!board) return <p className="text-sm text-brand-muted">Loading today…</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Today</h1>
        <p className="text-sm text-brand-muted">
          Follow-ups, handoffs, and the sales calendar for the marketing pipeline.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {board.metrics.map((metric) => (
          <section key={metric.label} className="bg-white border border-brand-border rounded-xl p-4">
            <div className="text-xs text-brand-muted">{metric.label}</div>
            <div className="text-xl font-bold text-brand-text mt-1">{metric.value}</div>
          </section>
        ))}
      </div>

      {!board.workspaceConnected && (
        <p className="text-sm text-brand-muted mb-4">
          Google Calendar is not connected, so follow-up dates stay in the CRM only.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-brand-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-brand-text mb-3">Follow-ups</h2>
          {board.followUps.length === 0 && <p className="text-sm text-brand-muted">No follow-ups due this week.</p>}
          <div className="space-y-1">
            {board.followUps.map((row) => (
              <Link key={row.id} href={`/admin/pipeline/${row.id}`} className="block rounded-lg px-2 py-2 -mx-2 hover:bg-neutral-50">
                <div className="text-sm font-medium text-brand-text">{row.business}</div>
                <div className="text-xs text-brand-muted">{formatWhen(row.followUpAt)} · {STAGE_LABELS[row.stage]}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border border-brand-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-brand-text mb-3">Needs attention</h2>
          {board.handoffs.length === 0 && <p className="text-sm text-brand-muted">Nothing is waiting on a handoff.</p>}
          <div className="space-y-1">
            {board.handoffs.map((row) => (
              <Link key={row.id} href={row.href} className="block rounded-lg px-2 py-2 -mx-2 hover:bg-neutral-50">
                <div className="text-sm font-medium text-brand-text">{row.business}</div>
                <div className="text-xs text-brand-muted">{STAGE_LABELS[row.stage]}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white border border-brand-border rounded-xl p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-brand-text mb-3">Today on the calendar</h2>
          {board.calendarEvents.length === 0 && <p className="text-sm text-brand-muted">No events on the sales calendar today.</p>}
          <div className="space-y-1">
            {board.calendarEvents.map((event) => (
              <a key={event.id} href={event.htmlLink || '#'} className="block rounded-lg px-2 py-2 -mx-2 hover:bg-neutral-50" target="_blank" rel="noreferrer">
                <div className="text-sm font-medium text-brand-text">{event.summary}</div>
                <div className="text-xs text-brand-muted">{formatWhen(event.start)}</div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
