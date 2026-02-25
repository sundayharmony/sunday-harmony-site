'use client'

import { SessionProvider } from 'next-auth/react'
import ClientSidebar from '@/components/dashboard/ClientSidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-[#0a0a0f] text-[#d8d6d1]">
        <ClientSidebar />
        <main className="ml-0 md:ml-[240px] p-4 md:p-8 min-h-screen">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}
