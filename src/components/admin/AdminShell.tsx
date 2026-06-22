'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
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
    <AdminShellContext.Provider value={{ sidebarCollapsed, toggleSidebar }}>
      <AdminSidebar collapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} hydrated={hydrated} />
      <main className={`${marginClass} p-4 md:p-8 transition-[margin] duration-200 min-h-screen`}>
        {children}
      </main>
    </AdminShellContext.Provider>
  )
}
