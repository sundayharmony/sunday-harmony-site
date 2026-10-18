import { getClients } from '@/lib/db'
import { packages } from '@/lib/data'
import StatCard from '@/components/ui/StatCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminOverview() {
  const clients = await getClients()

  const activeClients = clients.filter(c => c.status === 'active')
  const mrr = activeClients.reduce((sum, c) => sum + c.monthly_price, 0)

  // Revenue by tier
  const tierCounts: Record<string, number> = {}
  activeClients.forEach(c => {
    tierCounts[c.package_tier] = (tierCounts[c.package_tier] || 0) + 1
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Dashboard</h1>
        <p className="text-sm text-brand-muted">Welcome back. Here&apos;s your business at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Active Clients" value={activeClients.length} />
        <StatCard label="Monthly Revenue" value={`$${mrr.toLocaleString()}`} color="accent" />
        <StatCard label="Annual Projection" value={`$${(mrr * 12).toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Quick Actions */}
        <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-brand-text mb-5">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { href: '/admin/crm', icon: '📋', label: 'CRM Overview', desc: 'Contacts, meetings & pipeline' },
              { href: '/admin/clients', icon: '👥', label: 'Manage Clients', desc: `${activeClients.length} active clients` },
              { href: '/admin/roadmap', icon: '🗺️', label: '90-Day Roadmap', desc: 'Track your launch plan' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-brand-border transition-all"
              >
                <span className="text-lg">{item.icon}</span>
                <div>
                  <div className="text-sm font-medium text-brand-text">{item.label}</div>
                  <div className="text-xs text-brand-dim">{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue by Tier */}
      {activeClients.length > 0 && (
        <div className="mt-6 bg-white border border-brand-border rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-bold text-brand-text mb-4">Revenue by Package</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {packages.map(pkg => {
              const count = tierCounts[pkg.tier.toLowerCase().replace(/\s+/g, '_')] || 0
              const revenue =
                pkg.price == null ? 'Custom' : `$${(count * pkg.price).toLocaleString()}/mo`
              return (
                <div key={pkg.tier} className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="text-xs text-brand-dim mb-1">{pkg.tier}</div>
                  <div className="text-lg font-bold text-brand-text">{count} clients</div>
                  <div className="text-xs text-accent">{revenue}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
