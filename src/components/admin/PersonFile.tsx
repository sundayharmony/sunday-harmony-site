'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BillingPanel from '@/components/billing/BillingPanel'
import CreditRepairBillingPanel from '@/components/billing/CreditRepairBillingPanel'
import type { PersonFile } from '@/lib/people-db'

type TaskRow = {
  id: string
  title: string
  status: string
  due_date: string | null
}

type MessageRow = {
  id: string
  from_role: 'admin' | 'client'
  from_name: string
  text: string
  created_at: string
}

type ReferralPayload = {
  profile?: { code?: string; link?: string }
  summary?: { availableCents?: number; pendingCents?: number }
  referrals?: { id: string; name?: string; email?: string; status?: string }[]
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
      <h2 className="text-sm font-bold text-brand-text mb-3">{title}</h2>
      {children}
    </section>
  )
}

export default function PersonFileView({ id }: { id: string }) {
  const router = useRouter()
  const [file, setFile] = useState<PersonFile | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [messageText, setMessageText] = useState('')
  const [referral, setReferral] = useState<ReferralPayload | null>(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/people/${encodeURIComponent(id)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFile(null)
        setError(res.status === 404 ? 'This person is not on your list.' : 'Could not open this person.')
        return
      }
      setFile(data)
    } catch {
      setError('Could not open this person.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const clientId = file?.person.clientId || file?.client?.id || file?.repairClient?.id || ''

  useEffect(() => {
    if (!clientId) return
    void (async () => {
      const [taskRes, messageRes] = await Promise.all([
        fetch(`/api/admin/tasks?client_id=${encodeURIComponent(clientId)}`),
        fetch(`/api/admin/messages?clientId=${encodeURIComponent(clientId)}`),
      ])
      if (taskRes.ok) {
        const rows = await taskRes.json().catch(() => [])
        setTasks(Array.isArray(rows) ? rows : [])
      }
      if (messageRes.ok) {
        const rows = await messageRes.json().catch(() => [])
        setMessages(Array.isArray(rows) ? rows : [])
      }
    })()
  }, [clientId])

  useEffect(() => {
    if (!file?.showReferrals || !clientId) return
    void (async () => {
      const res = await fetch(`/api/admin/referrals/${encodeURIComponent(clientId)}`)
      if (!res.ok) return
      setReferral(await res.json().catch(() => null))
    })()
  }, [file?.showReferrals, clientId])

  async function cancelBooking(bookingId: string) {
    setBusy(bookingId)
    try {
      const res = await fetch('/api/admin/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', id: bookingId }),
      })
      if (res.ok) await load()
    } finally {
      setBusy('')
    }
  }

  async function addTask() {
    const title = taskTitle.trim()
    if (!title || !clientId) return
    setBusy('task')
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, title }),
      })
      if (res.ok) {
        setTaskTitle('')
        const rows = await fetch(`/api/admin/tasks?client_id=${encodeURIComponent(clientId)}`)
        const data = await rows.json().catch(() => [])
        setTasks(Array.isArray(data) ? data : [])
      }
    } finally {
      setBusy('')
    }
  }

  async function setTaskStatus(taskId: string, status: string) {
    const res = await fetch('/api/admin/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status }),
    })
    if (!res.ok) return
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)))
  }

  async function deleteClientAccount() {
    if (!file?.client?.id) return
    const label = file.client.name.trim() || file.client.business
    if (!window.confirm(
      `Delete the client account for "${label}"? Their portal login, billing, messages, tasks, and vault files will be removed. This cannot be undone.\n\nIf this person still has a lead or credit application, they may remain in People as a contact until you clean that up separately.`
    )) return

    setBusy('delete-client')
    setError('')
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: file.client.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message = typeof data.error === 'string' ? data.error : 'Failed to delete client'
        if (res.status === 403) {
          setError('Only an admin can delete client accounts. Credit managers cannot delete clients.')
        } else {
          setError(message)
        }
        return
      }
      router.push('/admin/people')
      router.refresh()
    } catch {
      setError('Failed to delete client')
    } finally {
      setBusy('')
    }
  }

  async function sendMessage() {
    const text = messageText.trim()
    if (!text || !clientId) return
    setBusy('message')
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, text }),
      })
      if (res.ok) {
        setMessageText('')
        const rows = await fetch(`/api/admin/messages?clientId=${encodeURIComponent(clientId)}`)
        const data = await rows.json().catch(() => [])
        setMessages(Array.isArray(data) ? data : [])
      }
    } finally {
      setBusy('')
    }
  }

  if (loading) return <p className="text-sm text-brand-muted">Opening person…</p>
  if (error || !file) return <p className="text-sm text-brand-red">{error || 'This person is not on your list.'}</p>

  const { person } = file
  const isAdmin = file.role === 'admin'

  return (
    <div className="space-y-4">
      <Link href="/admin/people" className="text-xs font-semibold text-accent hover:underline">
        ← People
      </Link>

      <header className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text">{person.name}</h1>
        <p className="text-sm text-brand-muted mt-1">
          {[person.business, person.email, person.phone].filter(Boolean).join(' · ') || 'No contact details yet'}
        </p>
        {isAdmin && (
          <a href="/book" className="inline-block mt-3 text-xs font-semibold text-accent hover:underline">
            Book a consultation
          </a>
        )}
      </header>

      {isAdmin && file.bookings.length > 0 && (
        <Section title="Consultation">
          <div className="space-y-3">
            {file.bookings.map((booking) => (
              <div key={booking.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm text-brand-text">{formatWhen(booking.startsAt)} ET</div>
                  <div className="text-xs text-brand-muted capitalize">{booking.status}{booking.note ? ` · ${booking.note}` : ''}</div>
                  {booking.meetLink && booking.status === 'scheduled' && (
                    <a href={booking.meetLink} className="text-xs font-semibold text-accent hover:underline" target="_blank" rel="noreferrer">
                      Open Meet
                    </a>
                  )}
                </div>
                {booking.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => void cancelBooking(booking.id)}
                    disabled={busy === booking.id}
                    className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {file.applications.length > 0 && (
        <Section title="Credit & Funding">
          <div className="space-y-3">
            {file.applications.map((application) => (
              <div key={application.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-brand-text">{application.statusLabel}</div>
                <Link
                  href={`/admin/credit-funding?id=${encodeURIComponent(application.id)}`}
                  className="inline-flex justify-center px-3 py-2 rounded-lg bg-brand-text text-white text-xs font-bold"
                >
                  Open credit workspace
                </Link>
              </div>
            ))}
          </div>
        </Section>
      )}

      {isAdmin && file.client && (
        <Section title="Client">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim">Package</div>
              <div className="text-brand-text">{file.client.packageLabel}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim">Account</div>
              <div className="text-brand-text capitalize">
                {file.client.status}{file.client.isPotential ? ' · potential' : ' · portal'}
              </div>
            </div>
          </div>
          {file.client.deliverables.length > 0 && (
            <ul className="text-sm text-brand-text space-y-1 mb-3">
              {file.client.deliverables.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/admin/clients?client=${encodeURIComponent(file.client.id)}`} className="text-xs font-semibold text-accent hover:underline">
              Edit deliverables and notes
            </Link>
            <button
              type="button"
              onClick={() => void deleteClientAccount()}
              disabled={busy === 'delete-client'}
              className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50"
            >
              {busy === 'delete-client' ? 'Deleting…' : 'Delete client account'}
            </button>
          </div>
        </Section>
      )}

      {isAdmin && file.client && (
        <Section title="Billing">
          <BillingPanel client={file.client.billing} adminView onUpdated={() => void load()} />
        </Section>
      )}

      {!isAdmin && file.repairClient && (
        <Section title="Repair fee">
          <CreditRepairBillingPanel client={file.repairClient} adminView onUpdated={() => void load()} />
        </Section>
      )}

      {file.showReferrals && clientId && (
        <Section title="Referrals">
          {referral?.profile?.code ? (
            <div className="space-y-2 text-sm">
              <div className="text-brand-text">Code {referral.profile.code}</div>
              {referral.profile.link && (
                <a href={referral.profile.link} className="block text-xs text-accent break-all hover:underline">
                  {referral.profile.link}
                </a>
              )}
              <div className="text-brand-muted">
                {formatCents(referral.summary?.availableCents || 0)} ready to pay
                {(referral.summary?.pendingCents || 0) > 0
                  ? ` · ${formatCents(referral.summary?.pendingCents || 0)} pending`
                  : ''}
              </div>
              <Link href={`/admin/referrals/${encodeURIComponent(clientId)}`} className="text-xs font-semibold text-accent hover:underline">
                Pay commissions
              </Link>
            </div>
          ) : (
            <p className="text-sm text-brand-muted">No referral code yet.</p>
          )}
        </Section>
      )}

      {clientId && (
        <Section title="Tasks">
          <div className="space-y-2 mb-3">
            {tasks.length === 0 && <p className="text-sm text-brand-muted">No tasks yet.</p>}
            {tasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-brand-text">{task.title}</div>
                <button
                  type="button"
                  onClick={() => void setTaskStatus(task.id, task.status === 'completed' ? 'not_started' : 'completed')}
                  className="text-xs font-semibold text-accent hover:underline text-left"
                >
                  {task.status === 'completed' ? 'Reopen' : 'Mark done'}
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addTask()
              }}
              placeholder="Add a task"
              className="flex-1 py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void addTask()}
              disabled={busy === 'task'}
              className="px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </Section>
      )}

      {clientId && (
        <Section title="Messages">
          <div className="space-y-3 mb-3 max-h-80 overflow-y-auto">
            {messages.length === 0 && <p className="text-sm text-brand-muted">No messages yet.</p>}
            {messages.map((message) => (
              <div key={message.id} className="text-sm">
                <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim">
                  {message.from_name || message.from_role} · {formatWhen(message.created_at)} ET
                </div>
                <p className="text-brand-text whitespace-pre-wrap">{message.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              rows={3}
              placeholder="Write a message"
              className="w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={busy === 'message'}
              className="self-start px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </Section>
      )}
    </div>
  )
}
