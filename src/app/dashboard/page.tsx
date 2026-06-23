'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import StatCard from '@/components/ui/StatCard'
import { getDisplayFirstName } from '@/lib/display-name'

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
  free: 'Free (Testing)',
  social_essentials: 'Social Essentials',
  spark: 'Spark',
  growth: 'Growth',
  scale: 'Scale',
}

function normalizeClientData(data: ClientData): ClientData {
  return {
    ...data,
    quick_wins: Array.isArray(data.quick_wins) ? data.quick_wins : [],
    deliverables: Array.isArray(data.deliverables) ? data.deliverables : [],
  }
}

export default function DashboardHome() {
  const { data: session } = useSession()
  const [client, setClient] = useState<ClientData | null>(null)
  const [messages, setMessages] = useState<MessageData[]>([])
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchData() {
      try {
        const [clientRes, msgRes, onbRes] = await Promise.all([
          fetch('/api/dashboard/profile', { signal: controller.signal }),
          fetch('/api/dashboard/messages', { signal: controller.signal }),
          fetch('/api/dashboard/onboarding', { signal: controller.signal }),
        ])
        if (clientRes.ok) {
          const clientData = await clientRes.json()
          if (clientData) setClient(normalizeClientData(clientData as ClientData))
        }
        if (msgRes.ok) {
          const msgs = await msgRes.json()
          setMessages(msgs.slice(-3))
        }
        if (onbRes.ok) {
          const onb = await onbRes.json()
          setOnboardingDone(onb?.completed || false)
        } else {
          setOnboardingDone(false)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to load dashboard data', err)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    return () => controller.abort()
  }, [])

  const userName = getDisplayFirstName({
    name: client?.name || session?.user?.name,
    email: session?.user?.email,
  })
  const daysSinceStart = client && client.start_date
    ? Math.floor((Date.now() - new Date(client.start_date).getTime()) / 86400000)
    : 0
  const quickWins = client?.quick_wins ?? []
  const completedWins = quickWins.filter((w) => w.done).length
  const totalWins = quickWins.length
  const winsPercent = totalWins > 0 ? Math.round((completedWins / totalWins) * 100) : 0

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
          Welcome back, {userName}
        </h1>
        <p className="text-sm text-brand-muted">
          Here&apos;s what&apos;s happening with your marketing.
        </p>
      </div>

      {/* Onboarding Prompt */}
      {onboardingDone === false && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4">
          <span className="text-3xl">📝</span>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-brand-text">Complete Your Getting Started Questionnaire</h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Help us understand your business so we can build the perfect marketing strategy for you.
            </p>
          </div>
          <a
            href="/dashboard/onboarding"
            className="px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold hover:bg-neutral-800 transition-all whitespace-nowrap"
          >
            Get Started
          </a>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Your Package"
          value={client ? tierLabels[client.package_tier] || client.package_tier : '—'}
        />
        <StatCard
          label="Days Active"
          value={daysSinceStart.toString()}
        />
        <StatCard
          label="Quick Wins Done"
          value={`${completedWins}/${totalWins}`}
          color="accent"
        />
        <StatCard
          label="Monthly Investment"
          value={client ? `$${client.monthly_price.toLocaleString()}` : '—'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Wins Progress */}
        <div className="bg-white border border-brand-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-brand-text">Quick Wins</h2>
            <span className="text-xs text-brand-green font-semibold">{winsPercent}% complete</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-neutral-200 rounded-full mb-4">
            <div
              className="h-2.5 rounded-full bg-brand-green transition-all"
              style={{ width: `${winsPercent}%` }}
            />
          </div>

          {client?.quick_wins && client.quick_wins.length > 0 ? (
            <div className="space-y-2">
              {client.quick_wins.map((win, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    win.done
                      ? 'bg-accent-soft border border-accent'
                      : 'bg-gray-50 border border-brand-border'
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
        <div className="bg-white border border-brand-border rounded-2xl p-6">
          <h2 className="text-base font-bold text-brand-text mb-4">What We&rsquo;re Delivering</h2>
          {client?.deliverables && client.deliverables.length > 0 ? (
            <div className="space-y-2">
              {client.deliverables.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-accent-soft border border-accent"
                >
                  <span className="text-accent text-sm">◈</span>
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
      <div className="mt-6 bg-white border border-brand-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-brand-text">Recent Messages</h2>
          <Link href="/dashboard/messages" className="text-xs text-accent hover:underline">
            View all →
          </Link>
        </div>
        {messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.from_role === 'admin'
                    ? 'bg-accent-soft border border-accent'
                    : 'bg-green-50 border border-green-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-brand-text">{msg.from_name}</span>
                  <span className="text-[10px] text-brand-dim">
                    {new Date(msg.created_at).toLocaleDateString()}
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
      <div className="mt-6 bg-accent-soft border border-accent/20 rounded-2xl p-4 sm:p-5">
        <h3 className="font-serif text-sm font-bold text-brand-text mb-1">Need Help?</h3>
        <p className="text-xs text-brand-muted mb-3">
          Have a question or need support? We&apos;re here to help.
        </p>
        <a
          href="/dashboard/messages"
          className="text-xs font-bold text-accent hover:underline"
        >
          Send us a message &rarr;
        </a>
      </div>
    </div>
  )
}
