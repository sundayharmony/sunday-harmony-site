'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface StaffMessage {
  id: string
  from_user_id: string
  from_name?: string
  from_role?: string
  text: string
  created_at: string
}

export default function AdminTeamMessagesPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<StaffMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const currentUserId = session?.user?.id

  const loadMessages = async () => {
    const res = await fetch('/api/admin/staff-messages')
    if (res.ok) setMessages(await res.json())
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadMessages()
      } catch {
        setError('Failed to load messages')
      } finally {
        setLoading(false)
      }
    })()
    const interval = setInterval(() => void loadMessages(), 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim() || sending) return

    setSending(true)
    const msgText = newMsg.trim()
    const optimistic: StaffMessage = {
      id: `temp-${Date.now()}`,
      from_user_id: currentUserId || '',
      from_name: session?.user?.name || 'You',
      from_role: session?.user?.role,
      text: msgText,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setNewMsg('')

    try {
      const res = await fetch('/api/admin/staff-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msgText }),
      })
      if (!res.ok) throw new Error('Failed to send')
      const saved = await res.json()
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)))
      setError('')
    } catch {
      setError('Failed to send message. Please try again.')
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setNewMsg(msgText)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading team chat...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Team Chat</h1>
        <p className="text-sm text-brand-muted">
          Private messaging between admin and credit manager staff.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm min-h-[calc(100vh-14rem)]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[400px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-16">
              <span className="text-3xl" aria-hidden>💬</span>
              <span className="text-sm text-brand-dim">No team messages yet</span>
              <span className="text-xs text-brand-dim">Start the conversation below.</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.from_user_id === currentUserId
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl p-4 ${
                      isMine
                        ? 'bg-accent-soft border border-accent'
                        : 'bg-neutral-50 border border-brand-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-brand-text">
                        {isMine ? 'You' : msg.from_name || 'Staff'}
                      </span>
                      {msg.from_role === 'credit_manager' && !isMine && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-brand-muted">
                          Credit Manager
                        </span>
                      )}
                      <span className="text-[10px] text-brand-dim">
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>
                    <p className="text-sm text-brand-text whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={sendMessage} className="p-3 border-t border-brand-border flex gap-3">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Message your team..."
            className="flex-1 py-2.5 px-4 bg-neutral-50 border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={!newMsg.trim() || sending}
            className="px-5 py-2.5 rounded-xl bg-brand-text text-white text-sm font-bold hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
