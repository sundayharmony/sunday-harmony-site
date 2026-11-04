'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatStaffMessageTime } from '@/lib/staff-direct-messages'
import { formatUnreadBadgeCount } from '@/lib/credit-funding-message-alerts'

type Colleague = {
  id: string
  name: string
  role: string
  roleLabel: string
  preview: string | null
  previewFromSelf: boolean
  previewAt: string | null
  unread: boolean
}

type DirectMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  createdAt: string
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.error === 'string' && body.error.trim()) return body.error
  } catch {
    /* ignore */
  }
  return fallback
}

function StaffDirectMessagesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const withParam = searchParams.get('with')
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [viewerId, setViewerId] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const threadRequest = useRef(0)
  const openedFromQuery = useRef<string | null>(null)

  const unreadCount = useMemo(() => colleagues.filter((person) => person.unread).length, [colleagues])
  const unreadLabel = formatUnreadBadgeCount(unreadCount)

  const loadInbox = useCallback(async () => {
    const res = await fetch('/api/admin/staff-direct-messages')
    if (!res.ok) throw new Error(await readError(res, 'Could not load staff.'))
    const data = await res.json()
    setViewerId(typeof data.viewerId === 'string' ? data.viewerId : '')
    setColleagues(Array.isArray(data.colleagues) ? data.colleagues : [])
  }, [])

  const loadThread = useCallback(async (colleagueId: string, quiet = false) => {
    const token = quiet ? threadRequest.current : ++threadRequest.current
    if (!quiet) setThreadLoading(true)
    try {
      const res = await fetch(`/api/admin/staff-direct-messages?with=${encodeURIComponent(colleagueId)}`)
      if (token !== threadRequest.current) return
      if (!res.ok) throw new Error(await readError(res, 'Could not open that thread.'))
      const data = await res.json()
      if (token !== threadRequest.current) return
      setMessages(Array.isArray(data.messages) ? data.messages : [])
      if (typeof data.viewerId === 'string') setViewerId(data.viewerId)
      setColleagues((current) =>
        current.map((person) => (person.id === colleagueId ? { ...person, unread: false } : person))
      )
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('staff-messages-read'))
      }
      setError('')
    } finally {
      if (!quiet && token === threadRequest.current) setThreadLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await loadInbox()
        if (!cancelled) setError('')
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load staff.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadInbox().catch(() => {})
    }, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [loadInbox])

  useEffect(() => {
    if (!selectedId) return
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadThread(selectedId, true).catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [loadThread, selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, selectedId])

  async function openColleague(id: string, options?: { syncUrl?: boolean }) {
    setSelectedId(id)
    setMobileThreadOpen(true)
    setMessages([])
    if (options?.syncUrl !== false) {
      router.replace(`/admin/messages?with=${encodeURIComponent(id)}`, { scroll: false })
    }
    try {
      await loadThread(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that thread.')
    }
  }

  useEffect(() => {
    if (!withParam || loading) return
    if (openedFromQuery.current === withParam) return
    if (!colleagues.some((person) => person.id === withParam)) return
    openedFromQuery.current = withParam
    void openColleague(withParam, { syncUrl: false })
    // openColleague identity changes each render; only react to query + inbox readiness
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withParam, loading, colleagues])

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending || !selectedId) return
    setSending(true)
    const optimistic: DirectMessage = {
      id: `temp-${Date.now()}`,
      senderId: viewerId,
      senderName: 'You',
      text,
      createdAt: new Date().toISOString(),
    }
    setMessages((current) => [...current, optimistic])
    setDraft('')
    try {
      const res = await fetch('/api/admin/staff-direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: selectedId, text }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to send message.'))
      const data = await res.json()
      const saved = data.message as DirectMessage | undefined
      setMessages((current) => current.map((message) => (message.id === optimistic.id && saved ? saved : message)))
      setColleagues((current) =>
        current.map((person) =>
          person.id === selectedId
            ? { ...person, preview: text, previewFromSelf: true, previewAt: saved?.createdAt || optimistic.createdAt, unread: false }
            : person
        )
      )
      setError('')
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id))
      setDraft(text)
      setError(err instanceof Error ? err.message : 'Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  const selected = colleagues.find((person) => person.id === selectedId) || null

  if (loading) {
    return <p className="text-sm text-brand-muted">Loading messages...</p>
  }

  return (
    <div>
      <div className="mb-4 md:mb-6">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-3xl font-extrabold text-brand-text">Messages</h1>
          {unreadCount > 0 ? (
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold leading-none text-white"
              aria-label={`${unreadCount} unread staff message${unreadCount === 1 ? '' : 's'}`}
            >
              {unreadLabel}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-brand-muted">Message other staff. This inbox stays inside the team.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="md:grid md:h-[calc(100dvh-8rem)] md:min-h-[32rem] md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] md:gap-4">
        <section
          className={`${mobileThreadOpen ? 'hidden' : 'flex'} md:flex min-h-[50vh] md:min-h-0 flex-col overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm`}
          aria-label="Staff"
        >
          {colleagues.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm font-medium text-brand-text">No messages yet</p>
              <p className="text-xs text-brand-dim">No other staff to message yet.</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {colleagues.map((person) => {
                const selectedRow = person.id === selectedId
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => void openColleague(person.id)}
                    className={`mb-1 w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedRow
                        ? 'border-brand-border bg-accent-soft text-brand-text'
                        : 'border-transparent hover:bg-neutral-50'
                    }`}
                    aria-current={selectedRow ? 'true' : undefined}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-brand-text">{person.name}</span>
                      {person.unread && (
                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white">
                          1
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-brand-dim">{person.roleLabel}</span>
                    {person.preview && (
                      <span className="mt-1 block truncate text-[11px] text-brand-muted">
                        {person.previewFromSelf ? 'You: ' : ''}
                        {person.preview}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section
          className={`${mobileThreadOpen ? 'flex' : 'hidden'} md:flex h-[calc(100dvh-8rem)] min-h-[70vh] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-brand-border bg-white shadow-sm md:h-auto md:min-h-0`}
          aria-label="Thread"
        >
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b border-brand-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => setMobileThreadOpen(false)}
                  className="shrink-0 text-xs font-semibold text-accent md:hidden"
                >
                  ← Staff
                </button>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-brand-text">{selected.name}</div>
                  <div className="text-xs text-brand-dim">{selected.roleLabel}</div>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {threadLoading ? (
                  <p className="text-sm text-brand-dim">Loading thread...</p>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                    <p className="text-sm font-medium text-brand-text">No messages yet</p>
                    <p className="text-xs text-brand-dim">Send the first message below.</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine = message.senderId === viewerId
                    return (
                      <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl border p-3 md:max-w-[70%] ${
                            mine ? 'border-accent bg-accent-soft' : 'border-brand-border bg-neutral-50'
                          }`}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-brand-text">{mine ? 'You' : message.senderName}</span>
                            <time className="text-[10px] text-brand-dim" dateTime={message.createdAt}>
                              {formatStaffMessageTime(message.createdAt)}
                            </time>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-brand-text">{message.text}</p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>
              <form
                onSubmit={(event) => void sendMessage(event)}
                className="flex gap-2 border-t border-brand-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <label htmlFor="staff-direct-message" className="sr-only">
                  Message {selected.name}
                </label>
                <input
                  id="staff-direct-message"
                  type="text"
                  value={draft}
                  maxLength={10000}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Message ${selected.name.split(' ')[0]}...`}
                  className="min-w-0 flex-1 rounded-xl border border-brand-border bg-neutral-50 px-4 py-2.5 text-sm text-brand-text outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="rounded-xl bg-brand-text px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="hidden h-full flex-col items-center justify-center gap-1 p-6 text-center md:flex">
              <p className="text-sm font-medium text-brand-text">No messages yet</p>
              <p className="text-xs text-brand-dim">Select someone on staff to open a thread.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function StaffDirectMessages() {
  return (
    <Suspense fallback={<p className="text-sm text-brand-muted">Loading messages...</p>}>
      <StaffDirectMessagesContent />
    </Suspense>
  )
}
