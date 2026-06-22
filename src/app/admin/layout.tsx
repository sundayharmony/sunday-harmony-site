import AdminShell from '@/components/admin/AdminShell'

export const metadata = {
  title: 'Admin Dashboard | Sunday Harmony',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg-soft">
      <AdminShell>{children}</AdminShell>
    </div>
  )
}
