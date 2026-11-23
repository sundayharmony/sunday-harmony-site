'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CALL_OUTCOMES,
  followUpForOutcome,
  type CallOutcome,
  type TimelineEntry,
} from '@/lib/marketing-workspace'

export type ActivityResult = {
  prospect?: { id: string; stage: string; followUpAt: string | null }
  timeline?: TimelineEntry[]
  warning?: string
}

const fieldClass = 'w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-text'

export function formatWhen(iso: string | null | undefined, withYear = false): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  })
}

function localInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const KIND_DOT: Record<TimelineEntry['kind'], string> = {
  call: 'bg-accent',
  note: 'bg-brand-text',
  email: 'bg-brand-blue',
  reply: 'bg-brand-green',
  update: 'bg-brand-border',
  milestone: 'bg-accent-ink',
}

export function Timeline({ entries, empty = 'Nothing logged yet.' }: { entries: TimelineEntry[]; empty?: string }) {
  if (entries.length === 0) return <p className="text-sm text-brand-muted">{empty}</p>
  return (
    <ol className="relative space-y-4 border-l border-brand-border pl-5">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="relative">
          <span className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-brand-bg ${KIND_DOT[entry.kind]}`} aria-hidden />
          <p className="text-sm font-semibold text-brand-text">{entry.title}</p>
          <p className="text-xs text-brand-dim">
            {formatWhen(entry.at, true)}
            {entry.actor ? ` · ${entry.actor}` : ''}
          </p>
          {entry.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-brand-muted">{entry.detail}</p>}
        </li>
      ))}
    </ol>
  )
}

/**
 * Log a call outcome or a note, then show the lead's timeline.
 * A call moves an early lead to Contacted and books the next follow-up.
 */
export default function ProspectActivity({
  prospectId,
  canEdit,
  phone,
  onLogged,
  autoFocus = false,
  refreshKey = 0,
}: {
  refreshKey?: number
  prospectId: string
  canEdit: boolean
  phone?: string
  onLogged?: (result: ActivityResult) => void
  autoFocus?: boolean
}) {
  const [mode, setMode] = useState<'call' | 'note'>('call')
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [followTouched, setFollowTouched] = useState(false)
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setTimeline(null)
    setOutcome(null)
    setNote('')
    setFollowUp('')
    setFollowTouched(false)
    setMessage('')
    setError('')
    void fetch(`/api/admin/pipeline/${prospectId}/activity`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled) setTimeline(Array.isArray(data.timeline) ? data.timeline : [])
      })
      .catch(() => {
        if (!cancelled) setTimeline([])
      })
    return () => {
      cancelled = true
    }
  }, [prospectId, refreshKey])

  const suggested = useMemo(() => (outcome ? followUpForOutcome(outcome, new Date()) : undefined), [outcome])
  useEffect(() => {
    if (followTouched) return
    setFollowUp(suggested ? localInput(suggested) : '')
  }, [suggested, followTouched])

  async function submit() {
    if (mode === 'call' && !outcome) return
    if (mode === 'note' && !note.trim()) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      // Untouched: the server books the outcome's default follow-up (the same one shown here).
      const followUpAt = followTouched ? (followUp ? new Date(followUp).toISOString() : null) : undefined
      const res = await fetch(`/api/admin/pipeline/${prospectId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: mode, outcome, note, ...(followUpAt !== undefined ? { followUpAt } : {}) }),
      })
      const data = (await res.json().catch(() => ({}))) as ActivityResult & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not save')
      if (data.timeline) setTimeline(data.timeline)
      setMessage(data.warning || (mode === 'call' ? 'Call logged.' : 'Note saved.'))
      setOutcome(null)
      setNote('')
      setFollowTouched(false)
      onLogged?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="rounded-2xl border border-brand-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div role="tablist" aria-label="Log" className="inline-flex rounded-full border border-brand-border p-1">
              {(['call', 'note'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => setMode(key)}
                  className={`min-h-9 rounded-full px-4 text-xs font-semibold ${mode === key ? 'bg-brand-text text-white' : 'text-brand-muted hover:text-brand-text'}`}
                >
                  {key === 'call' ? 'Log a call' : 'Add a note'}
                </button>
              ))}
            </div>
            {mode === 'call' && phone && (
              <a href={`tel:${phone}`} className="text-sm font-semibold text-accent-ink hover:underline">{phone}</a>
            )}
          </div>

          {mode === 'call' && (
            <fieldset>
              <legend className="sr-only">How did the call go?</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CALL_OUTCOMES.map((option, index) => (
                  <button
                    key={option.key}
                    type="button"
                    autoFocus={autoFocus && index === 0}
                    aria-pressed={outcome === option.key}
                    onClick={() => setOutcome(option.key)}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                      outcome === option.key
                        ? 'border-brand-text bg-brand-text text-white'
                        : 'border-brand-border bg-brand-bg text-brand-text hover:border-accent'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <label className="mt-3 block text-sm">
            <span className="sr-only">{mode === 'call' ? 'Call note' : 'Note'}</span>
            <textarea
              className={fieldClass}
              rows={mode === 'note' ? 4 : 2}
              value={note}
              placeholder={mode === 'call' ? 'What happened? (optional)' : 'What should the team know?'}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {(mode === 'note' || (outcome && outcome !== 'not_interested')) && (
            <label className="mt-3 block text-sm">
              <span className="font-medium text-brand-text">Next follow-up</span>
              <span className="mb-1 block text-xs text-brand-muted">
                {mode === 'call' && suggested && !followTouched
                  ? 'Set from the outcome. Change it if they gave you a time.'
                  : mode === 'note' ? 'Optional. Leave empty to keep the current one.' : 'Optional.'}
              </span>
              <input
                type="datetime-local"
                className={fieldClass}
                value={followUp}
                onChange={(event) => {
                  setFollowTouched(true)
                  setFollowUp(event.target.value)
                }}
              />
            </label>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || (mode === 'call' ? !outcome : !note.trim())}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-text px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : mode === 'call' ? 'Save call' : 'Save note'}
            </button>
            <p className="text-sm text-brand-muted" role="status" aria-live="polite">
              {error ? <span className="text-brand-red">{error}</span> : message}
            </p>
          </div>
        </div>
      )}

      <section aria-label="Timeline">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-ink">Timeline</p>
        {timeline === null ? <p className="text-sm text-brand-muted">Loading the timeline…</p> : <Timeline entries={timeline} />}
      </section>
    </div>
  )
}
