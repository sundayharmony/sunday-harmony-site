'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import StatCard from '@/components/ui/StatCard'

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

interface MessageData {
  id: string
  from_role: string
  from_name: string
  text: string
  created_at: string
}

const tierLabels: Record<string, string> = {
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

const tierColors: Record<string, string> = {
  social_essentials: '#4a9e7d',
  spark: '#3a8bc2',
  growth: '#c9a96e',
  scale: '#7b68c9',
}

export default function DashboardHome() {
  const { data: session } = useSession()
  const [client, setClient] = useState<ClientData | null>(null)
  const [messages, setMessages] = useState<MessageData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [clientRes, msgRes] = await Promise.all([
          fetch('/api/dashboard/profile'),
          fetch('/api/dashboard/messages'),
        ])
        if (clientRes.ok) setClient(await clientRes.json())
        if (msgRes.ok) {
          const msgs = await msgRes.json()
          setMessages(msgs.slice(-3)) // last 3 messages
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const userName = session?.user?.name || 'there'
  const daysSinceStart = client
    ? Math.floor((Date.now() - new Date(client.startDate).getTime()) / 86400000)
    : 0
  const completedWins = client?.quickWins?.filter(w => w.done).length || 0
  const totalWins = client?.quickWins?.length || 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-muted text-sm">Loading your dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">
          Welcome back, {userName.split(' ')[0]}
        </h1>
        <p className="text-sm text-brand-muted">
          Here&rsquo;s what&rsquo;s happening with your marketing.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Your Package"
          value={client ? tierLabels[client.packageTier] || client.packageTier : '—'}
          color={client ? tierColors[client.packageTier] || '#c9a96e' : '#c9a96e'}
        />
        <StatCard
          label="Days Active"
          value={daysSinceStart.toString()}
          color="#3a8bc2"
        />
        <StatCard
          label="Quick Wins Done"
          value={`${completedWins}/${totalWins}`}
          color="#4a9e7d"
        />
        <StatCard
          label="Monthly Investment"
          value={client ? `$${client.monthlyPrice.toLocaleString()}` : '—'}
          color="#7b68c9"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Quick Wins Progress */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-brand-text">Quick Wins</h2>
            <span className="text-xs text-brand-green font-semibold">
              {totalWins > 0 ? Math.round((completedWins / totalWins) * 100) : 0}% complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-[rgba(255,255,255,0.06)] rounded-full mb-4">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: totalWins > 0 ? `${(completedWins / totalWins) * 100}%` : '0%',
                background: '#4a9e7d',
              }}
            />
          </div>

          {client?.quickWins && client.quickWins.length > 0 ? (
            <div className="space-y-2">
              {client.quickWins.map((win, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    win.done
                      ? 'bg-[rgba(74,158,125,0.08)] border border-[rgba(74,158,125,0.15)]'
                      : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]'
                  }`}
                >
                  <span className={`text-sm ${win.done ? 'text-brand-green' : 'text-brand-dim'}`}>
                    {win.done ? '✓' : '○'}
                  </span>
                  <span className={`text-sm ${win.done ? 'text-brand-muted line-through' : 'text-brand-text'}`}>
                    {win.text}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-brand-dim">No quick wins set yet — your team is working on it.</p>
          )}
        </div>

        {/* Current Deliverables */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
          <h2 className="text-base font-bold text-brand-text mb-4">What We&rsquo;re Delivering</h2>
          {client?.deliverables && client.deliverables.length > 0 ? (
            <div className="space-y-2">
              {client.deliverables.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.1)]"
                >
                  <span className="text-brand-gold text-sm">◈</span>
                  <span className="text-sm text-brand-text">{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-brand-dim">Deliverables will appear here once your package is configured.</p>
          )}
        </div>
      </div>

      {/* Recent Messages */}
      <div className="mt-6 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-brand-text">Recent Messages</h2>
          <a href="/dashboard/messages" className="text-xs text-brand-gold hover:underline">
            View all →
          </a>
        </div>
        {messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.fromRole === 'admin'
                    ? 'bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.1)]'
                    : 'bg-[rgba(74,158,125,0.06)] border border-[rgba(74,158,125,0.1)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-brand-text">{msg.fromName}</span>
                  <span className="text-[10px] text-brand-dim">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-brand-muted">{msg.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-brand-dim">No messages yet. Send your first message to start a conversation.</p>
        )}
      </div>

      {/* Help Card */}
      <div className="mt-6 bg-[rgba(74,158,125,0.06)] border border-[rgba(74,158,125,0.15)] rounded-2xl p-6 text-center">
        <div className="text-base font-bold text-brand-green mb-1">Need help?</div>
        <p className="text-xs text-brand-muted mb-3">
          Questions about your package, results, or next steps? We&rsquo;re one message away.
        </p>
        <a
          href="/dashboard/messages"
          className="inline-block px-5 py-2 rounded-lg bg-[rgba(74,158,125,0.15)] border border-[rgba(74,158,125,0.3)] text-brand-green text-xs font-bold hover:bg-[rgba(74,158,125,0.25)] transition-all"
        >
          Send a Message
        </a>
      </div>
    </div>
  )
}
