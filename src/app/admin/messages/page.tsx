'use client'

import { useState, useEffect, useRef } from 'react'

interface Client {
  id: string
  name: string
  business: string
  status: string
}

interface Message {
  id: string
  client_id: string
  from_role: 'admin' | 'client'
  from_name: string
  text: string
  created_at: string
}

export default function AdminMessagesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Fetch clients and all messages on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [clientsRes, msgsRes] = await Promise.all([
          fetch('/api/admin/clients'),
          fetch('/api/admin/messages'),
        ])
        if (clientsRes.ok) setClients(await clientsRes.json())
        if (msgsRes.ok) setAllMessages(await msgsRes.json())
      } catch (err) {
        console.error('Failed to load data', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Poll for new messages every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/messages')
        if (res.ok) setAllMessages(await res.json())
      } catch (err) {
        console.warn('Message poll failed:', err)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Filter messages for selected client
  useEffect(() => {
    if (selectedClient) {
      setMessages(allMessages.filter(m => m.client_id === selectedClient))
    } else {
      setMessages([])
    }
  }, [selectedClient, allMessages])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Get unread count per client (messages from client that are recent)
  const getClientMsgCount = (clientId: string) => {
    return allMessages.filter(m => m.client_id === clientId).length
  }

  const getLastMessage = (clientId: string) => {
    const clientMsgs = allMessages.filter(m => m.client_id === clientId)
    return clientMsgs.length > 0 ? clientMsgs[clientMsgs.length - 1] : null
  }

  // Sort clients by most recent message
  const sortedClients = [...clients].sort((a, b) => {
    const aLast = getLastMessage(a.id)
    const bLast = getLastMessage(b.id)
    if (!aLast && !bLast) return 0
    if (!aLast) return 1
    if (!bLast) return -1
    return new Date(bLast.created_at).getTime() - new Date(aLast.created_at).getTime()
  })

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim() || sending || !selectedClient) return

    setSending(true)
    const msgText = newMsg.trim()

    // Optimistic update: add message to local state immediately
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      client_id: selectedClient,
      from_role: 'admin',
      from_name: 'You',
      text: msgText,
      created_at: new Date().toISOString(),
    }
    setAllMessages(prev => [...prev, optimisticMsg])
    setNewMsg('')

    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient, text: msgText }),
      })
      if (!res.ok) {
        throw new Error('Failed to send message')
      }
      const msg = await res.json()
      // Replace optimistic message with real one from server
      setAllMessages(prev => prev.map(m => m.id === optimisticMsg.id ? msg : m))
      setError('')
    } catch (err) {
      setError('Failed to send message. Please try again.')
      // Remove optimistic message on failure
      setAllMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      setNewMsg(msgText)
      console.error('Failed to send message', err)
    } finally {
      setSending(false)
    }
  }

  const selectedClientData = clients.find(c => c.id === selectedClient)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading messages...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Messages</h1>
        <p className="text-sm text-brand-muted">View and reply to client messages.</p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-12rem)]">
        {/* Client List */}
        <div className="bg-white border border-brand-border rounded-xl overflow-y-auto shadow-sm">
          {sortedClients.length === 0 ? (
            <div className="p-6 text-center text-sm text-brand-dim">
              No clients yet.
            </div>
          ) : (
            <div className="p-2">
              {sortedClients.map(client => {
                const lastMsg = getLastMessage(client.id)
                const msgCount = getClientMsgCount(client.id)
                const isSelected = selectedClient === client.id
                return (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClient(client.id)}
                    className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                      isSelected
                        ? 'bg-accent-soft border border-accent'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-brand-text">{client.name}</span>
                      {msgCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-soft text-accent">
                          {msgCount}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-brand-dim">{client.business}</div>
                    {lastMsg && (
                      <div className="text-[11px] text-brand-muted mt-1 truncate">
                        {lastMsg.from_role === 'admin' ? 'You: ' : ''}{lastMsg.text}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex flex-col bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
          {selectedClient ? (
            <>
              {/* Chat Header */}
              <div className="px-5 py-3 border-b border-brand-border flex items-center gap-3">
                <div>
                  <div className="text-sm font-bold text-brand-text">{selectedClientData?.name}</div>
                  <div className="text-xs text-brand-dim">{selectedClientData?.business}</div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <span className="text-3xl">💬</span>
                    <span className="text-sm text-brand-dim">No messages with this client yet</span>
                    <span className="text-xs text-brand-dim">Send the first message below.</span>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isAdmin = msg.from_role === 'admin'
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl p-4 ${
                            isAdmin
                              ? 'bg-accent-soft border border-accent'
                              : 'bg-green-50 border border-green-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold ${isAdmin ? 'text-accent' : 'text-brand-muted'}`}>
                              {msg.from_name}
                            </span>
                            <span className="text-[10px] text-brand-dim">
                              {msg.created_at ? new Date(msg.created_at).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              }) : '—'}
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

              {/* Reply Input */}
              <form onSubmit={sendMessage} className="p-3 border-t border-brand-border flex gap-3">
                <input
                  type="text"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder={`Reply to ${selectedClientData?.name ? selectedClientData.name.split(' ')[0] : 'client'}...`}
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-4xl">💬</span>
              <span className="text-sm text-brand-dim">Select a client to view messages</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
