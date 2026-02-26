'use client'

import { useState, useEffect } from 'react'

interface ClientData {
  id: string
  name: string
  business: string
  package_tier: string
  monthly_price: number
  start_date: string
  status: string
  deliverables: string[]
  quick_wins: { text: string; done: boolean }[]
}

const packages = [
  {
    tier: 'social_essentials',
    name: 'Social Essentials',
    price: 250,
    color: '#4a9e7d',
    tagline: 'Stay Active Online',
    features: [
      'Social media (2 platforms)',
      '8 custom posts/month',
      'Content calendar',
      'Community engagement',
      'Monthly metrics snapshot',
    ],
    ideal: 'New businesses & side hustles that need a social presence.',
  },
  {
    tier: 'spark',
    name: 'Spark',
    price: 500,
    color: '#3a8bc2',
    tagline: 'Get Found Online',
    features: [
      'Everything in Essentials',
      'Google Business optimization',
      'Basic local SEO',
      '12 posts/month (3/week)',
      'Review monitoring',
      'Performance snapshot',
    ],
    ideal: 'Businesses ready to show up in local search results.',
  },
  {
    tier: 'growth',
    name: 'Growth',
    price: 1800,
    color: '#c9a96e',
    tagline: 'Start Generating Leads',
    features: [
      'Everything in Spark',
      'Full local SEO strategy',
      'Google Ads (up to $2K)',
      'Review management',
      'Monthly strategy call',
      'Actionable monthly report',
    ],
    ideal: 'Established businesses ready to invest in real growth.',
  },
  {
    tier: 'scale',
    name: 'Scale',
    price: 3500,
    color: '#7b68c9',
    tagline: 'Full-Service Partner',
    features: [
      'Everything in Growth',
      'SEO + content marketing',
      'Google + Meta Ads ($5K)',
      'Email marketing',
      'Physical marketing',
      '20+ posts + reels',
      'Bi-weekly strategy calls',
      'Dedicated account manager',
    ],
    ideal: 'Ambitious businesses wanting a complete marketing partner.',
  },
]

export default function PackagePage() {
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => { setClient(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const currentPkg = packages.find(p => p.tier === client?.package_tier)
  const currentIdx = packages.findIndex(p => p.tier === client?.package_tier)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">My Package</h1>
        <p className="text-sm text-brand-muted">View your current plan and explore upgrade options.</p>
      </div>

      {/* Current Package */}
      {currentPkg && (
        <div
          className="rounded-2xl p-6 mb-8 border"
          style={{
            background: `${currentPkg.color}08`,
            borderColor: `${currentPkg.color}25`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ color: currentPkg.color, background: `${currentPkg.color}20` }}
              >
                Current Plan
              </span>
              <h2 className="text-2xl font-extrabold text-brand-text mt-2">{currentPkg.name}</h2>
              <p className="text-sm text-brand-muted">{currentPkg.tagline}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold" style={{ color: currentPkg.color }}>
                ${currentPkg.price}
              </div>
              <div className="text-xs text-brand-dim">/month</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">What&rsquo;s Included</div>
              <div className="space-y-1.5">
                {currentPkg.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span style={{ color: currentPkg.color }} className="text-xs">✓</span>
                    <span className="text-sm text-brand-text">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-brand-dim mb-2">Your Deliverables</div>
              {client?.deliverables && client.deliverables.length > 0 ? (
                <div className="space-y-1.5">
                  {client.deliverables.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-brand-gold text-xs">◈</span>
                      <span className="text-sm text-brand-text">{d}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-dim">Custom deliverables will appear here.</p>
              )}

              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase text-brand-dim mb-1">Member Since</div>
                <div className="text-sm text-brand-text">
                  {client?.start_date ? new Date(client.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Packages */}
      <h2 className="text-lg font-bold text-brand-text mb-4">All Packages</h2>
      <div className="grid grid-cols-2 gap-4">
        {packages.map((pkg, i) => {
          const isCurrent = pkg.tier === client?.package_tier
          const isUpgrade = i > currentIdx
          return (
            <div
              key={pkg.tier}
              className={`rounded-xl p-5 border transition-all ${
                isCurrent
                  ? 'ring-2 ring-offset-2 ring-offset-white'
                  : 'hover:bg-gray-50'
              }`}
              style={{
                background: isCurrent ? `${pkg.color}08` : 'white',
                borderColor: isCurrent ? `${pkg.color}30` : 'border-brand-border',
                ...(isCurrent ? { ['--tw-ring-color' as string]: `${pkg.color}40` } : {}),
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-base font-bold text-brand-text">{pkg.name}</div>
                  <div className="text-xs text-brand-muted">{pkg.tagline}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold" style={{ color: pkg.color }}>
                    ${pkg.price}
                  </div>
                  <div className="text-[10px] text-brand-dim">/mo</div>
                </div>
              </div>

              <div className="space-y-1 mb-3">
                {pkg.features.slice(0, 4).map((f, fi) => (
                  <div key={fi} className="flex items-center gap-2">
                    <span style={{ color: pkg.color }} className="text-[10px]">✓</span>
                    <span className="text-xs text-brand-muted">{f}</span>
                  </div>
                ))}
                {pkg.features.length > 4 && (
                  <span className="text-[10px] text-brand-dim">+{pkg.features.length - 4} more</span>
                )}
              </div>

              <div className="text-[10px] text-brand-dim mb-3">
                <span className="font-bold">Ideal for:</span> {pkg.ideal}
              </div>

              {isCurrent ? (
                <div
                  className="text-center text-xs font-bold py-2 rounded-lg"
                  style={{ color: pkg.color, background: `${pkg.color}15` }}
                >
                  Your Current Plan
                </div>
              ) : isUpgrade ? (
                <a
                  href="/dashboard/messages"
                  className="block text-center text-xs font-bold py-2 rounded-lg transition-all hover:opacity-80"
                  style={{
                    color: 'white',
                    background: pkg.color,
                  }}
                >
                  Ask About Upgrading →
                </a>
              ) : (
                <div className="text-center text-[10px] text-brand-dim py-2">
                  Previous tier
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
