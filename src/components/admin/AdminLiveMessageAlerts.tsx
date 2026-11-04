'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { clipMessagePreview, formatUnreadBadgeCount } from '@/lib/credit-funding-message-alerts'

type StaffToast = {
  id: string
  kind: 'staff' | 'client'
  title: string
  body: string
  href: string
}

type AlertsContextValue = {
  staffUnreadCount: number
  staffUnreadLabel: string
}

const AlertsContext = createContext<AlertsContextValue>({
  staffUnreadCount: 0,
  staffUnreadLabel: '',
})

export function useAdminLiveMessageAlerts() {
  return useContext(AlertsContext)
}

const TOAST_MS = 5500
const POLL_MS = 15000

type StaffColleague = {
  id: string
  name: string
  unread?: boolean
  preview?: string | null
  previewAt?: string | null
}

type ClientAlert = {
  id: string
  applicationUuid: string
  fullName: string
  fromName: string
  text: string
  createdAt: string
}

export default function AdminLiveMessageAlerts({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [staffUnreadCount, setStaffUnreadCount] = useState(0)
  const [toast, setToast] = useState<StaffToast | null>(null)
  const toastTimer = useRef<number | null>(null)
  const staffSeeded = useRef(false)
  const clientSeeded = useRef(false)
  const seenStaffUnread = useRef<Set<string>>(new Set())
  const seenClientIds = useRef<Set<string>>(new Set())

  const clearToastTimer = useCallback(() => {
    if (toastTimer.current != null) {
      window.clearTimeout(toastTimer.current)
      toastTimer.current = null
    }
  }, [])

  const showToast = useCallback(
    (next: StaffToast) => {
      clearToastTimer()
      setToast(next)
      toastTimer.current = window.setTimeout(() => {
        setToast(null)
        toastTimer.current = null
      }, TOAST_MS)
    },
    [clearToastTimer]
  )

  const pollStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff-direct-messages', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const colleagues = (Array.isArray(data.colleagues) ? data.colleagues : []) as StaffColleague[]
      const unread = colleagues.filter((person) => person.unread)
      setStaffUnreadCount(unread.length)
      const unreadKeys = unread.map(
        (person) => `${person.id}:${person.previewAt || person.preview || ''}`
      )

      if (!staffSeeded.current) {
        seenStaffUnread.current = new Set(unreadKeys)
        staffSeeded.current = true
        return
      }

      for (const person of unread) {
        const key = `${person.id}:${person.previewAt || person.preview || ''}`
        if (seenStaffUnread.current.has(key)) continue
        seenStaffUnread.current.add(key)
        // Still toast on the Messages page if they are not already in that thread.
        const viewingThisThread =
          pathname?.startsWith('/admin/messages') &&
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('with') === person.id
        if (viewingThisThread) continue
        showToast({
          id: `staff-${person.id}-${Date.now()}`,
          kind: 'staff',
          title: `Staff message from ${person.name}`,
          body: clipMessagePreview(person.preview),
          href: `/admin/messages?with=${encodeURIComponent(person.id)}`,
        })
        break
      }

      const unreadIdSet = new Set(unread.map((person) => person.id))
      for (const key of [...seenStaffUnread.current]) {
        const colleagueId = key.split(':')[0]
        if (!unreadIdSet.has(colleagueId)) seenStaffUnread.current.delete(key)
      }
    } catch {
      /* ignore transient poll errors */
    }
  }, [pathname, showToast])

  const pollClient = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/credit-funding/message-alerts', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const alerts = (Array.isArray(data.alerts) ? data.alerts : []) as ClientAlert[]

      if (!clientSeeded.current) {
        seenClientIds.current = new Set(alerts.map((alert) => alert.id))
        clientSeeded.current = true
        return
      }

      const fresh = alerts.filter((alert) => !seenClientIds.current.has(alert.id))
      for (const alert of fresh) seenClientIds.current.add(alert.id)
      if (fresh.length === 0) return

      const newest = fresh[0]
      showToast({
        id: `client-${newest.id}`,
        kind: 'client',
        title: `Message from ${newest.fromName || newest.fullName}`,
        body: clipMessagePreview(newest.text),
        href: `/admin/credit-funding?id=${encodeURIComponent(newest.applicationUuid)}&tab=messages`,
      })
    } catch {
      /* ignore */
    }
  }, [showToast])

  useEffect(() => {
    void pollStaff()
    void pollClient()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void pollStaff()
      void pollClient()
    }, POLL_MS)
    return () => {
      window.clearInterval(timer)
      clearToastTimer()
    }
  }, [clearToastTimer, pollClient, pollStaff])

  useEffect(() => {
    if (pathname?.startsWith('/admin/messages')) {
      void pollStaff()
    }
  }, [pathname, pollStaff])

  useEffect(() => {
    const refresh = () => {
      void pollStaff()
    }
    window.addEventListener('staff-messages-read', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('staff-messages-read', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [pollStaff])

  const value = useMemo(
    () => ({
      staffUnreadCount,
      staffUnreadLabel: formatUnreadBadgeCount(staffUnreadCount),
    }),
    [staffUnreadCount]
  )

  return (
    <AlertsContext.Provider value={value}>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3 md:px-6">
          <button
            type="button"
            className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border border-brand-border bg-white px-4 py-3 text-left shadow-[0_16px_40px_-20px_rgba(10,10,10,0.55)]"
            onClick={() => {
              const href = toast.href
              setToast(null)
              clearToastTimer()
              router.push(href)
            }}
          >
            <span
              className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
              aria-hidden
            >
              1
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-brand-text">{toast.title}</span>
              <span className="mt-0.5 block truncate text-xs text-brand-muted">{toast.body}</span>
            </span>
          </button>
        </div>
      ) : null}
      {children}
    </AlertsContext.Provider>
  )
}
