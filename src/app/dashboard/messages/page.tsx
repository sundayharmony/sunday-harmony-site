'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { MessageAttachments } from '@/components/portal/MessageAttachments'
import { parseThreadPayload, type PublicAttachment, type VaultFileChoice } from '@/lib/portal-message-mail'

interface MessageData {
  id: string
  from_role: 'admin' | 'client'
  from_name: string
  text: string
  created_at: string
  attachments?: PublicAttachment[]
}

export default function MessagesPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<MessageData[]>([])
  const [files, setFiles] = useState<VaultFileChoice[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [fileId, setFileId] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  async function fetchMessages(sync = false) {
    try {
      const res = await fetch(sync ? '/api/dashboard/messages?sync=1' : '/api/dashboard/messages')
      if (res.ok) {
        const parsed = parseThreadPayload(await res.json())
        setMessages(parsed.messages)
        setFiles(parsed.files)
      }
    } catch (err) {
      console.error('Failed to load messages', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchMessages(true)
    const interval = setInterval(() => void fetchMessages(false), 15000)
    const sync = setInterval(() => void fetchMessages(true), 120000)
    return () => {
      clearInterval(interval)
      clearInterval(sync)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const msgText = newMsg.trim()
    if ((!msgText && !fileId) || sending) return

    setSending(true)
    const senderName = session?.user?.name || 'You'
    const attached = files.find((file) => file.id === fileId)
    const optimisticMsg: MessageData = {
      id: `temp-${Date.now()}`,
      from_role: 'client',
      from_name: senderName,
      text: msgText || attached?.name || '',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setNewMsg('')
    setFileId('')

    try {
      const res = await fetch('/api/dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msgText, fileId: fileId || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to send message')
      }
      const msg = await res.json()
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? msg : m))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.')
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      setNewMsg(msgText)
      setFileId(fileId)
      console.error('Failed to send message', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Messages</h1>
        <p className="text-sm text-brand-muted">Chat directly with your Sunday Harmony team.</p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 bg-gray-50 border border-brand-border rounded-2xl p-4 overflow-y-auto mb-4">
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
                  className={`flex min-w-0 ${isClient ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] min-w-0 rounded-2xl p-4 ${
                      isClient
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-accent-soft border border-accent'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
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
                    <p className="text-sm text-brand-text whitespace-pre-wrap break-words">{msg.text}</p>
                    <MessageAttachments
                      messageId={msg.id}
                      attachments={msg.attachments}
                      basePath="/api/dashboard/messages"
                    />
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex shrink-0 flex-col gap-2">
        {files.length > 0 ? (
          <select
            aria-label="Attach a file"
            value={fileId}
            onChange={(event) => setFileId(event.target.value)}
            className="w-full py-2 px-3 bg-white border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-accent"
          >
            <option value="">No attachment</option>
            {files.map((file) => (
              <option key={file.id} value={file.id}>{file.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-brand-dim">
            Attach a file you already uploaded.{' '}
            <Link href="/dashboard/files" className="font-semibold text-accent hover:underline">Open Files</Link>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Type your message..."
            className="min-w-0 flex-1 py-3 px-4 bg-white border border-brand-border rounded-xl text-brand-text text-sm outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={(!newMsg.trim() && !fileId) || sending}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-text text-white text-sm font-bold hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
