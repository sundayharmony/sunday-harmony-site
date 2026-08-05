import type { Metadata } from 'next'
import AdminShell from '@/components/admin/AdminShell'
import { NO_INDEX } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  robots: NO_INDEX,
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg-soft">
      <AdminShell>{children}</AdminShell>
    </div>
  )
}
