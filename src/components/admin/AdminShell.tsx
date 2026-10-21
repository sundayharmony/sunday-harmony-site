'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { SessionProvider, signOut, useSession } from 'next-auth/react'
import AdminSidebar from '@/components/admin/AdminSidebar'

const STORAGE_KEY = 'admin-sidebar-collapsed'

type AdminShellContextValue = {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null)

export function useAdminShell() {
  const ctx = useContext(AdminShellContext)
  if (!ctx) throw new Error('useAdminShell must be used within AdminShell')
  return ctx
}

function AdminSessionGuard() {
  const { data } = useSession()

  useEffect(() => {
    if (data?.user?.sessionExpired) {
      void signOut({ callbackUrl: '/login' })
    }
  }, [data?.user?.sessionExpired])

  useEffect(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const response = await original(input, init)
      if (response.status !== 401) return response
      let code = ''
      try {
        const body = await response.clone().json()
        code = typeof body?.code === 'string' ? body.code : ''
      } catch {
        code = ''
      }
      if (code === 'SESSION_EXPIRED') {
        void signOut({ callbackUrl: '/login' })
      }
      return response
    }
    return () => {
      window.fetch = original
    }
  }, [])

  return null
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const marginClass = !hydrated
    ? 'md:ml-[240px]'
    : sidebarCollapsed
      ? 'md:ml-0'
      : 'md:ml-[240px]'

  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <AdminSessionGuard />
      <AdminShellContext.Provider value={{ sidebarCollapsed, toggleSidebar }}>
        <AdminSidebar collapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} hydrated={hydrated} />
        <main className={`${marginClass} p-4 pt-14 pl-12 md:p-8 md:pt-8 md:pl-8 transition-[margin] duration-200 min-h-screen`}>
          {children}
        </main>
      </AdminShellContext.Provider>
    </SessionProvider>
  )
}
