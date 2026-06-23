'use client'

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { sanitizeNotificationLink } from '@/lib/safe-notification-link'

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

const PANEL_WIDTH = 320
const VIEWPORT_MARGIN = 8

interface NotificationBellProps {
  /** Preferred horizontal alignment when space allows */
  align?: 'start' | 'end'
}

export default function NotificationBell({ align = 'end' }: NotificationBellProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [fetchWarning, setFetchWarning] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)

    let left =
      align === 'start'
        ? rect.left
        : rect.right - panelWidth

    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - panelWidth - VIEWPORT_MARGIN))

    const top = rect.bottom + 8
    const maxHeight = Math.min(384, window.innerHeight - top - VIEWPORT_MARGIN)

    setPanelStyle({
      position: 'fixed',
      top,
      left,
      width: panelWidth,
      maxHeight: Math.max(160, maxHeight),
      zIndex: 70,
    })
  }, [align])

  useLayoutEffect(() => {
    if (!open) return
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/dashboard/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : [])
        setUnreadCount((Array.isArray(data) ? data : []).filter((n: NotificationItem) => !n.read).length)
        setFetchWarning(false)
      } else {
        console.warn('Notifications fetch failed:', res.status)
        setFetchWarning(true)
      }
    } catch (err) {
      console.warn('Notifications fetch error:', err)
      setFetchWarning(true)
    }
  }

  async function markRead(id: string) {
    await fetch('/api/dashboard/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await fetch('/api/dashboard/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  function navigateForNotification(n: NotificationItem) {
    const safe = sanitizeNotificationLink(n.link)
    if (safe) {
      router.push(safe)
    }
    setOpen(false)
  }

  const panel = open && mounted ? (
    <div
      ref={panelRef}
      id="notification-panel"
      role="dialog"
      aria-label="Notifications"
      style={panelStyle}
      className="bg-white border border-brand-border rounded-xl shadow-lg overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between p-3 border-b border-brand-border shrink-0">
        <span className="text-sm font-bold text-brand-text">Notifications</span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-[10px] text-accent hover:underline font-semibold"
          >
            Mark all read
          </button>
        )}
      </div>

      {fetchWarning && (
        <div className="px-3 py-1.5 text-[10px] text-amber-800 bg-amber-50 border-b border-amber-100 shrink-0">
          Could not refresh notifications. Will retry automatically.
        </div>
      )}

      <div className="overflow-y-auto flex-1 min-h-0">
        {notifications.length > 0 ? (
          notifications.slice(0, 20).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.read) void markRead(n.id)
                navigateForNotification(n)
              }}
              className={`w-full text-left flex items-start gap-3 px-3 py-3 border-b border-brand-border cursor-pointer transition-colors ${
                n.read ? 'bg-white' : 'bg-accent-soft'
              } hover:bg-gray-50`}
            >
              <span className="text-base mt-0.5 shrink-0">{typeIcons[n.type] || 'ℹ️'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${n.read ? 'text-brand-muted' : 'text-brand-text'}`}>
                    {n.title}
                  </span>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-accent shrink-0" aria-hidden />}
                </div>
                {n.message && (
                  <p className="text-[11px] text-brand-dim mt-0.5 line-clamp-2">{n.message}</p>
                )}
                <span className="text-[10px] text-brand-dim mt-0.5 block">
                  {new Date(n.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="p-6 text-center">
            <div className="text-2xl mb-1">🔔</div>
            <p className="text-xs text-brand-dim">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls="notification-panel"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 2a5 5 0 015 5c0 4.5 2 6 2 6H3s2-1.5 2-6a5 5 0 015-5z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-brand-text rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
