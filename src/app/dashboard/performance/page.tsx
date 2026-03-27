'use client'

import { useState, useEffect } from 'react'

interface ActivityEntry {
  id: string
  action: string
  entity_type: string
  details?: string
  created_at: string
}

interface ClientData {
  id: string
  name: string
  business: string
  package_tier: string
  monthly_price: number
  start_date: string
  status: string
}

const categoryColors: Record<string, string> = {
  'Social Media': '#3a8bc2',
  'Local SEO': '#4a9e7d',
  SEO: '#4a9e7d',
  Reputation: '#c9a96e',
  Email: '#7b68c9',
  Website: '#3a8bc2',
  Strategy: '#c9a96e',
  General: '#6b7280',
}

function guessCategory(action: string): string {
  const lower = action.toLowerCase()
  if (lower.includes('social') || lower.includes('post') || lower.includes('instagram') || lower.includes('facebook')) return 'Social Media'
  if (lower.includes('seo') || lower.includes('keyword') || lower.includes('ranking')) return 'SEO'
  if (lower.includes('google business') || lower.includes('local')) return 'Local SEO'
  if (lower.includes('review') || lower.includes('reputation')) return 'Reputation'
  if (lower.includes('email') || lower.includes('campaign') || lower.includes('newsletter')) return 'Email'
  if (lower.includes('website') || lower.includes('speed') || lower.includes('page')) return 'Website'
  if (lower.includes('strategy') || lower.includes('call') || lower.includes('plan')) return 'Strategy'
  return 'General'
}

const tierLabels: Record<string, string> = {
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

export default function PerformancePage() {
  const [client, setClient] = useState<ClientData | null>(null)
  const [activities, setActivities] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const [clientRes, activityRes] = await Promise.all([
          fetch('/api/dashboard/profile'),
          fetch('/api/dashboard/activity'),
        ])
        if (clientRes.ok) setClient(await clientRes.json())
        if (activityRes.ok) setActivities(await activityRes.json())
      } catch {
        setError('Failed to load performance data. Please try refreshing.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const daysSinceStart = client && client.start_date
    ? Math.floor((Date.now() - new Date(client.start_date).getTime()) / 86400000)
    : 0

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
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Performance</h1>
        <p className="text-sm text-brand-muted">Track your marketing results and recent activity.</p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-brand-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim mb-1">Package</div>
          <div className="text-lg font-extrabold text-brand-text">
            {client ? tierLabels[client.package_tier] || client.package_tier : 'â'}
          </div>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim mb-1">Days Active</div>
          <div className="text-lg font-extrabold text-brand-blue">{daysSinceStart}</div>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim mb-1">Monthly Investment</div>
          <div className="text-lg font-extrabold text-brand-green">
            {client ? `$${client.monthly_price.toLocaleString()}` : 'â'}
          </div>
        </div>
        <div className="bg-white border border-brand-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-brand-dim mb-1">Activities Logged</div>
          <div className="text-lg font-extrabold text-brand-purple">{activities.length}</div>
        </div>
      </div>

      {/* Analytics Coming Soon */}
      <div className="bg-white border border-brand-border rounded-2xl p-8 mb-6 text-center">
        <div className="text-4xl mb-3">ð</div>
        <h2 className="text-lg font-bold text-brand-text mb-2">Analytics Dashboard Coming Soon</h2>
        <p className="text-sm text-brand-muted max-w-md mx-auto mb-4">
          We&rsquo;re setting up integrations with Google Analytics, Google Business Profile, and social media insights so you can see real-time performance data here.
        </p>
        <p className="text-xs text-brand-dim">
          In the meantime, check your monthly reports in{' '}
          <a href="/dashboard/messages" className="text-brand-gold hover:underline font-semibold">
            Messages
          </a>{' '}
          or ask your team for an update.
        </p>
      </div>

      {/* Activity Log */}
      <div className="bg-white border border-brand-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-brand-text mb-4">Activity Log</h2>
        <p className="text-xs text-brand-muted mb-4">Recent work your Sunday Harmony team has done for your business.</p>

        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((item) => {
              const category = guessCategory(item.action)
              const catColor = categoryColors[category] || '#6b7280'
              return (
                <div key={item.id} className="flex items-start gap-4 p-3 rounded-lg bg-gray-50 border border-brand-border">
                  <div className="text-xs text-brand-dim whitespace-nowrap pt-0.5">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'â'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-brand-text">{item.action}</p>
                    {item.details && (
                      <p className="text-xs text-brand-muted mt-0.5">{item.details}</p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      color: catColor,
                      background: `${catColor}15`,
                      border: `1px solid ${catColor}30`,
                    }}
                  >
                    {category}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">ð</div>
            <p className="text-sm text-brand-muted">No activity logged yet.</p>
            <p className="text-xs text-brand-dim mt-1">
              Your Sunday Harmony team will log work here as your campaign progresses.
            </p>
          </div>
        )}
      </div>

      {/* Help Card */}
      <div className="mt-6 bg-[rgba(184,148,63,0.08)] border border-brand-gold rounded-xl p-4 text-center">
        <p className="text-sm text-brand-muted">
          Want a performance update?{' '}
          <a href="/dashboard/messages" className="text-brand-gold hover:underline font-semibold">
            Send us a message
          </a>{' '}
          and we&rsquo;ll send you a detailed report.
        </p>
      </div>
    </div>
  )
}
