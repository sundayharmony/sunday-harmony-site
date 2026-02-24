'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface MessageData {
  id: string
  fromRole: 'admin' | 'client'
  fromName: string
  text: string
  createdAt: string
}

export default function MessagesPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<MessageData[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
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
    try {
      const res = await fetch('/api/dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newMsg.trim() }),
      })
      if (res.ok) {
        setNewMsg('')
        await fetchMessages()
      }
    } catch (err) {
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

      {/* Messages Area */}
      <div className="flex-1 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 overflow-y-auto mb-4">
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
              const isClient = msg.fromRole === 'client'
              return (
                <div
                  key={msg.id}
                  className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl p-4 ${
                      isClient
                        ? 'bg-[rgba(74,158,125,0.12)] border border-[rgba(74,158,125,0.2)]'
                        : 'bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.15)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${isClient ? 'text-brand-green' : 'text-brand-gold'}`}>
                        {msg.fromName}
                      </span>
                      <span className="text-[10px] text-brand-dim">
                        {new Date(msg.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
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
          className="flex-1 py-3 px-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl text-brand-text text-sm outline-none focus:border-[rgba(74,158,125,0.3)] transition-colors"
        />
        <button
          type="submit"
          disabled={!newMsg.trim() || sending}
          className="px-6 py-3 rounded-xl bg-gradient-to-br from-brand-green to-[#3a8a6d] text-white text-sm font-bold hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
