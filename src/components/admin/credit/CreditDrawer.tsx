'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  getNextWorkflowStatus,
  type ApplicationStatus,
} from '@/lib/credit-funding-types'
import {
  PHASE_LABELS,
  clientPhase,
  deadlineDays,
  feeOwed,
  money,
  needsFunding,
  roundStatusLabel,
  type DeskClient,
} from '@/lib/credit-desk'

type Message = { id: string; from_role: 'admin' | 'applicant'; from_name: string; text: string; created_at: string }
type DocRequest = { id: string; label: string; status: string; created_at: string }

const pill = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition'
const kicker = 'text-[11px] font-bold uppercase tracking-[0.14em] text-accent-ink'
const field = 'w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-text'

function when(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function deadlineText(days: number | null): string {
  if (days == null) return 'No deadline set'
  if (days < 0) return `Deadline passed ${-days} day${days === -1 ? '' : 's'} ago`
  if (days === 0) return 'Responses due today'
  return `Responses due in ${days} day${days === 1 ? '' : 's'}`
}

export type DrawerStep = { id: string; name: string }

export default function CreditDrawer({
  client,
  role,
  experts,
  sequence,
  onClose,
  onOpen,
  onChanged,
}: {
  client: DeskClient | null
  role: string
  experts: { id: string; name: string }[]
  sequence: DrawerStep[]
  onClose: () => void
  onOpen: (id: string) => void
  onChanged: () => void
}) {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [requests, setRequests] = useState<DocRequest[]>([])
  const [status, setStatus] = useState<ApplicationStatus | null>(null)
  const [expert, setExpert] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const id = client?.id || null

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setMessages(null)
    setRequests([])
    setNotice('')
    setError('')
    setReply('')
    void fetch(`/api/admin/credit-funding?id=${encodeURIComponent(id)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Could not open this client.')
          setMessages([])
          return
        }
        setMessages(Array.isArray(data.messages) ? data.messages : [])
        setRequests(Array.isArray(data.docRequests) ? data.docRequests.filter((r: DocRequest) => r.status === 'pending') : [])
      })
      .catch(() => !cancelled && setMessages([]))
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    setStatus(client?.status || null)
    setExpert(client?.assignedSpecialist || '')
  }, [client?.status, client?.assignedSpecialist, client?.id])

  const open = Boolean(id)
  useEffect(() => {
    if (!open || !mounted) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, mounted, onClose])

  if (!client || !mounted) return null

  const phase = clientPhase(client)
  const current = status || client.status
  const next = getNextWorkflowStatus(current, needsFunding(client.serviceType))
  const position = sequence.findIndex((step) => step.id === client.id)
  const nextClient = position >= 0 ? sequence[position + 1] : undefined
  const latestSession = [...client.rounds].reverse().find((round) => round.sessionId)?.sessionId

  async function patch(body: Record<string, unknown>, done: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/credit-funding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client!.id, ...body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save')
      if (typeof data.status === 'string') setStatus(data.status as ApplicationStatus)
      setNotice(done)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function sendReply() {
    if (!reply.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/credit-funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: client!.id, text: reply.trim() }),
      })
      if (!res.ok) throw new Error('Could not send')
      const now = new Date().toISOString()
      setMessages((list) => [...(list || []), { id: now, from_role: 'admin', from_name: 'You', text: reply.trim(), created_at: now }])
      setReply('')
      setNotice('Message sent to the client portal.')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button type="button" aria-label="Close client" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-brand-text/30" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-brand-bg shadow-[0_0_60px_-20px_rgba(27,26,23,0.5)] sm:max-w-[480px] sm:border-l sm:border-brand-border"
      >
        <header className="shrink-0 border-b border-brand-border bg-white px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={kicker}>{PHASE_LABELS[phase]} · {STATUS_LABELS[current]}</p>
              <h2 id="credit-drawer-title" className="mt-1 truncate font-serif text-2xl text-brand-text">{client.name || 'Unnamed client'}</h2>
              <p className="truncate text-sm text-brand-muted">
                {[client.applicationId, client.expertName ? `Expert: ${client.expertName}` : 'No expert assigned'].join(' · ')}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-muted hover:bg-brand-bg-soft hover:text-brand-text"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {client.phone && <a href={`tel:${client.phone}`} className={`${pill} bg-brand-text text-white`}>Call {client.phone}</a>}
            {client.email && <a href={`mailto:${client.email}`} className={`${pill} border border-brand-border bg-white text-brand-text hover:border-accent`}>Email</a>}
            {latestSession && (
              <Link href={`/admin/dispute-letters/${latestSession}/letters`} className={`${pill} border border-brand-border bg-white text-brand-text hover:border-accent`}>Letters</Link>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          {error && <p className="text-sm text-brand-red" role="alert">{error}</p>}
          {notice && <p className="text-sm text-brand-muted" role="status">{notice}</p>}

          <section className="space-y-3">
            <p className={kicker}>Status</p>
            {next && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void patch({ status: next }, `Moved to ${STATUS_LABELS[next]}. The client was notified.`)}
                className={`${pill} w-full bg-brand-text text-white disabled:opacity-50`}
              >
                Move to {STATUS_LABELS[next]}
              </button>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-brand-text">Set status</span>
                <select
                  className={field}
                  value={current}
                  disabled={busy}
                  onChange={(event) => void patch({ status: event.target.value }, `Status set to ${STATUS_LABELS[event.target.value as ApplicationStatus]}. The client was notified.`)}
                >
                  {APPLICATION_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
                </select>
              </label>
              {role === 'admin' && (
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-brand-text">Credit expert</span>
                  <select
                    className={field}
                    value={expert}
                    disabled={busy}
                    onChange={(event) => {
                      setExpert(event.target.value)
                      void patch({ assigned_specialist: event.target.value || null }, event.target.value ? 'Expert assigned.' : 'Expert removed.')
                    }}
                  >
                    <option value="">Nobody</option>
                    {experts.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            <p className="text-xs text-brand-muted">Status changes email the client and show in their portal.</p>
          </section>

          <section className="space-y-3">
            <p className={kicker}>Dispute rounds</p>
            {client.rounds.length === 0 ? (
              <p className="text-sm text-brand-muted">No rounds yet. Start one from the letters workspace in the full file.</p>
            ) : (
              <ol className="space-y-2">
                {[...client.rounds].reverse().map((round) => {
                  const days = deadlineDays(round, new Date())
                  const late = round.status !== 'closed' && days != null && days < 0
                  return (
                    <li key={round.id} className="flex items-center justify-between gap-3 rounded-2xl border border-brand-border bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-text">Round {round.roundNumber} · {roundStatusLabel(round.status)}</p>
                        <p className={`text-xs ${late ? 'font-semibold text-brand-red' : 'text-brand-muted'}`}>
                          {round.status === 'closed' ? `Mailed ${when(round.mailedAt) || '—'}` : round.status === 'letters_ready' ? 'Not mailed yet' : deadlineText(days)}
                        </p>
                      </div>
                      {round.sessionId && (
                        <Link href={`/admin/dispute-letters/${round.sessionId}/letters`} className="shrink-0 text-sm font-semibold text-accent-ink hover:underline">Open</Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
            <dl className="grid grid-cols-3 gap-2 text-center">
              {([['In dispute', client.items.disputed + client.items.selected], ['Removed', client.items.deleted + client.items.updated], ['Not started', client.items.pending]] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white px-2 py-2 ring-1 ring-brand-border">
                  <dd className="text-lg font-semibold tabular-nums text-brand-text">{value}</dd>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-brand-dim">{label}</dt>
                </div>
              ))}
            </dl>
          </section>

          {(client.billingModel === 'credit_repair_one_time' || requests.length > 0) && (
            <section className="space-y-2">
              <p className={kicker}>Waiting on</p>
              {client.billingModel === 'credit_repair_one_time' && (
                <p className="text-sm text-brand-text">
                  Repair fee: {client.feePaidAt ? `${money(client.feeCents)} paid ${when(client.feePaidAt)}` : feeOwed(client) ? <span className="font-semibold text-brand-red">{money(client.feeCents)} unpaid</span> : 'not set yet'}
                </p>
              )}
              {requests.map((request) => (
                <p key={request.id} className="text-sm text-brand-text">Document: {request.label} <span className="text-brand-dim">· asked {when(request.created_at)}</span></p>
              ))}
            </section>
          )}

          <section className="space-y-3">
            <p className={kicker}>Messages</p>
            {messages === null ? (
              <p className="text-sm text-brand-muted">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-brand-muted">No messages yet.</p>
            ) : (
              <ul className="space-y-2">
                {messages.slice(-6).map((message) => (
                  <li
                    key={message.id}
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${message.from_role === 'admin' ? 'ml-auto bg-brand-text text-white' : 'bg-white text-brand-text ring-1 ring-brand-border'}`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    <p className={`mt-1 text-[11px] ${message.from_role === 'admin' ? 'text-white/70' : 'text-brand-dim'}`}>{message.from_name} · {when(message.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
            <label className="block text-sm">
              <span className="sr-only">Reply to the client</span>
              <textarea className={field} rows={3} value={reply} placeholder="Reply in the client portal…" onChange={(event) => setReply(event.target.value)} />
            </label>
            <button
              type="button"
              onClick={() => void sendReply()}
              disabled={busy || !reply.trim()}
              className={`${pill} bg-brand-text text-white disabled:opacity-50`}
            >
              Send reply
            </button>
          </section>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-brand-border bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Link href={`/admin/credit-funding?id=${encodeURIComponent(client.id)}`} className={`${pill} border border-brand-border bg-white text-brand-text hover:border-accent`}>
            Open full file
          </Link>
          {nextClient && (
            <button type="button" onClick={() => onOpen(nextClient.id)} className={`${pill} bg-accent-soft text-brand-text hover:bg-accent hover:text-white`}>
              <span className="max-w-[12rem] truncate">Next: {nextClient.name}</span>
              <span aria-hidden>→</span>
            </button>
          )}
        </footer>
      </aside>
    </div>,
    document.body
  )
}
