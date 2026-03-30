'use client'

import { useState, useEffect, useRef } from 'react'

interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  link: string
  read: boolean
  created_at: string
}

const typeIcons: Record<string, string> = {
  message: '💬',
  task: '✅',
  file: '📁',
  billing: '💳',
  approval: '📋',
  info: 'ℹ️',
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/dashboard/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
        setUnreadCount(data.filter((n: NotificationItem) => !n.read).length)
      }
    } catch { /* silent */ }
  }

  async function markRead(id: string) {
    await fetch('/api/dashboard/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await fetch('/api/dashboard/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 2a5 5 0 015 5c0 4.5 2 6 2 6H3s2-1.5 2-6a5 5 0 015-5z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-brand-red rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-brand-border rounded-xl shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-brand-border">
            <span className="text-sm font-bold text-brand-text">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-brand-gold hover:underline font-semibold">
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length > 0 ? (
              notifications.slice(0, 20).map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markRead(n.id)
                    if (n.link) window.location.href = n.link
                  }}
                  className={`flex items-start gap-3 px-3 py-3 border-b border-brand-border cursor-pointer transition-colors ${
                    n.read ? 'bg-white' : 'bg-[rgba(184,148,63,0.04)]'
                  } hover:bg-gray-50`}
                >
                  <span className="text-base mt-0.5">{typeIcons[n.type] || 'ℹ️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${n.read ? 'text-brand-muted' : 'text-brand-text'}`}>
                        {n.title}
                      </span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-brand-gold flex-shrink-0" />}
                    </div>
                    {n.message && (
                      <p className="text-[11px] text-brand-dim mt-0.5 truncate">{n.message}</p>
                    )}
                    <span className="text-[10px] text-brand-dim mt-0.5 block">
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center">
                <div className="text-2xl mb-1">🔔</div>
                <p className="text-xs text-brand-dim">No notifications yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
