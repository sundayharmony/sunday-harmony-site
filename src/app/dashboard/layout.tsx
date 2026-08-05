import type { Metadata } from 'next'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Client Portal',
  robots: NO_INDEX,
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
