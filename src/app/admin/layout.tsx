import AdminSidebar from '@/components/admin/AdminSidebar'

export const metadata = {
  title: 'Admin Dashboard | Sunday Harmony',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <AdminSidebar />
      <main className="ml-[240px] p-8">
        {children}
      </main>
    </div>
  )
}
