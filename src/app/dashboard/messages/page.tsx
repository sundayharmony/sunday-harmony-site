'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface MessageData {
  id: string
  from_role: 'admin' | 'client'
  from_name: string
  text: string
  created_at: string
}

export default function MessagesPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<MessageData[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMessages()
    // Poll for new messages every 15 seconds
    const interval = setInterval(fetchMessages, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMessages() {
    try {
      const res = await fetch('/api/dashboard/messages')
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (err) {
      console.error('Failed to load messages', err)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || sending) return

    setSending(true)
    const msgText = newMsg.trim()

    // Optimistic update: add message to local state immediately
    const senderName = session?.user?.name || 'You'
    const optimisticMsg: MessageData = {
      id: `temp-${Date.now()}`,
      from_role: 'client',
      from_name: senderName,
      text: msgText,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setNewMsg('')

    try {
      const res = await fetch('/api/dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msgText }),
      })
      if (!res.ok) {
        throw new Error('Failed to send message')
      }
      const msg = await res.json()
      // Replace optimistic message with real one from server
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? msg : m))
      setError('')
    } catch (err) {
      setError('Failed to send message. Please try again.')
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      setNewMsg(msgText)
      console.error('Failed to send message', err)
    } finally {
      setSending(false)
    }
  }

  const userName = session?.user?.name || 'You'

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Messages</h1>
        <p className="text-sm text-brand-muted">Chat directly with your Sunday Harmony team.</p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 bg-gray-50 border border-brand-border rounded-2xl p-4 overflow-y-auto mb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-brand-dim">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <span className="text-3xl">💬</span>
            <span className="text-sm text-brand-dim">No messages yet</span>
            <span className="text-xs text-brand-dim">Send a message to start a conversation with your team.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isClient = msg.from_role === 'client'
              return (
                <div
                  key={msg.id}
                  className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl p-4 ${
                      isClient
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-accent-soft border border-accent'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${isClient ? 'text-brand-muted' : 'text-accent'}`}>
                        {msg.from_name}
                      </span>
                      <span className="text-[10px] text-brand-dim">
                        {msg.created_at ? new Date(msg.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        }) : '—'}
                      </span>
                    </div>
                    <p className="text-sm text-brand-text whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="flex gap-3">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 py-3 px-4 bg-white border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!newMsg.trim() || sending}
          className="px-6 py-3 rounded-xl bg-brand-text text-white text-sm font-bold hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
