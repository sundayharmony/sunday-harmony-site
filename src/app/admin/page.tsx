import { getLeads, getClients } from '@/lib/db'
import { packages } from '@/lib/data'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminOverview() {
  const leads = await getLeads()
  const clients = await getClients()

  const activeClients = clients.filter(c => c.status === 'active')
  const mrr = activeClients.reduce((sum, c) => sum + c.monthly_price, 0)
  const newLeads = leads.filter(l => l.status === 'new').length
  const recentLeads = leads.slice(0, 5)

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
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Clients" value={activeClients.length} color="green" />
        <StatCard label="Monthly Revenue" value={`$${mrr.toLocaleString()}`} color="gold" />
        <StatCard label="New Leads" value={newLeads} color="blue" />
        <StatCard label="Annual Projection" value={`$${(mrr * 12).toLocaleString()}`} color="purple" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-sm font-bold text-brand-text">Recent Leads</h2>
            <Link href="/admin/leads" className="text-xs text-brand-gold hover:underline">View all →</Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-brand-dim">No leads yet. They&apos;ll appear here when someone submits the contact form.</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map(lead => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                  <div>
                    <div className="text-sm font-medium text-brand-text">{lead.first_name} {lead.last_name}</div>
                    <div className="text-xs text-brand-dim">{lead.business}</div>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-6">
          <h2 className="text-sm font-bold text-brand-text mb-5">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { href: '/admin/leads', icon: '📥', label: 'Manage Leads', desc: `${leads.length} total leads` },
              { href: '/admin/clients', icon: '👥', label: 'Manage Clients', desc: `${activeClients.length} active clients` },
              { href: '/admin/revenue', icon: '💰', label: 'Revenue Calculator', desc: 'Project your growth' },
              { href: '/admin/roadmap', icon: '🗺️', label: '90-Day Roadmap', desc: 'Track your launch plan' },
              { href: '/admin/outreach', icon: '📨', label: 'Outreach Scripts', desc: '4 ready-to-use templates' },
              { href: '/admin/competitors', icon: '⚔️', label: 'Competitor Analysis', desc: '6 competitors mapped' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.03)] border border-transparent hover:border-[rgba(255,255,255,0.06)] transition-all"
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
        <div className="mt-6 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-xl p-6">
          <h2 className="text-sm font-bold text-brand-text mb-4">Revenue by Package</h2>
          <div className="grid grid-cols-4 gap-3">
            {packages.map(pkg => {
              const count = tierCounts[pkg.tier.toLowerCase().replace(/\s+/g, '_')] || 0
              return (
                <div key={pkg.tier} className="p-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                  <div className="text-xs text-brand-dim mb-1">{pkg.tier}</div>
                  <div className="text-lg font-bold text-brand-text">{count} clients</div>
                  <div className="text-xs text-brand-gold">${(count * pkg.price).toLocaleString()}/mo</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
