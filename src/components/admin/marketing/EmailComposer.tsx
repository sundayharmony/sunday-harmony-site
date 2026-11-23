'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { outreachScripts, type OutreachScript } from '@/lib/marketing-scripts'

export type ComposerProspect = {
  id: string
  business: string
  contactName: string
  email: string
  category: string
  gmailThreadId: string | null
}

const fieldClass = 'w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm text-brand-text'

/** A thread already exists: follow up in it. Otherwise pitch by category. */
export function defaultScriptId(prospect: Pick<ComposerProspect, 'category' | 'gmailThreadId'>): OutreachScript['id'] {
  if (prospect.gmailThreadId) return 'follow_up'
  return prospect.category === 'startup' ? 'startup' : 'established'
}

/**
 * Send from the sales mailbox without leaving the drawer. Replies land in the
 * same Gmail thread; the reply sweep and the timeline pick them up.
 */
export default function EmailComposer({
  prospect,
  workspaceConnected,
  onSent,
  onCancel,
}: {
  prospect: ComposerProspect
  workspaceConnected: boolean
  onSent: (prospect: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const { data: session } = useSession()
  const scripts = useMemo(
    () => outreachScripts({ business: prospect.business, contactName: prospect.contactName, senderName: session?.user?.name || '' })
      .filter((script) => script.channel === 'email'),
    [prospect.business, prospect.contactName, session?.user?.name]
  )
  const initial = scripts.find((script) => script.id === defaultScriptId(prospect)) || scripts[0]
  const [scriptId, setScriptId] = useState<string>(initial?.id || '')
  const [subject, setSubject] = useState(initial?.subject || '')
  const [body, setBody] = useState(initial?.body || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function pick(id: string) {
    const script = scripts.find((row) => row.id === id)
    setScriptId(id)
    if (!script) return
    setSubject(script.subject)
    setBody(script.body)
  }

  async function send() {
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/pipeline/${prospect.id}/gmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send')
      onSent(data.prospect || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setSending(false)
    }
  }

  if (!workspaceConnected) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-4 text-sm text-brand-muted">
        Gmail is not connected, so the desk cannot send or track email yet.{' '}
        <a href={`mailto:${prospect.email}`} className="font-semibold text-accent-ink hover:underline">Open your mail app instead</a>.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-brand-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-text">Email {prospect.email}</p>
        {prospect.gmailThreadId && <span className="text-xs text-brand-dim">Replies in the same thread</span>}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-text">Template</span>
        <select className={fieldClass} value={scriptId} onChange={(event) => pick(event.target.value)}>
          {scripts.map((script) => (
            <option key={script.id} value={script.id}>{script.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-text">Subject</span>
        <input className={fieldClass} value={subject} onChange={(event) => setSubject(event.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-text">Message</span>
        <textarea className={`${fieldClass} leading-6`} rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <p className="text-xs text-brand-muted">Read it before sending. Never promise results.</p>
      {error && <p className="text-sm text-brand-red" role="alert">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !subject.trim() || !body.trim()}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-text px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send email'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-border px-5 text-sm font-semibold text-brand-text hover:border-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
