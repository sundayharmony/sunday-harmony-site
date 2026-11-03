'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import CloserBilling from '@/components/admin/CloserBilling'
import MeetingJoinList from '@/components/admin/MeetingJoinList'
import type { JoinableMeeting } from '@/lib/joinable-meetings'
import { STAGE_LABELS, type PipelineStage } from '@/lib/marketing-pipeline'

type BillableDeal = {
  id: string
  business: string
  paymentStatus: string
  servicesPurchased: string
  clientId: string | null
}

type MarketingToday = {
  kind: 'marketing'
  role: string
  followUps: { id: string; business: string; followUpAt: string | null; stage: PipelineStage }[]
  handoffs: { id: string; business: string; stage: PipelineStage; href: string }[]
  billable?: BillableDeal[]
  meetings?: JoinableMeeting[]
  calendarEvents: { id: string; summary: string; start: string; htmlLink: string }[]
  metrics: { label: string; value: string }[]
  workspaceConnected: boolean
}

function formatWhen(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function QuickStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center p-4 rounded-xl bg-white/60">
      <div className={`text-2xl font-bold ${highlight ? 'text-accent' : 'text-brand-text'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-brand-dim font-medium mt-1">{label}</div>
    </div>
  )
}

function DealRow({
  href,
  business,
  detail,
  badge,
  badgeColor = 'neutral',
}: {
  href: string
  business: string
  detail?: string
  badge?: string
  badgeColor?: 'neutral' | 'blue' | 'orange' | 'green' | 'accent'
}) {
  const badgeColors = {
    neutral: 'bg-neutral-100 text-neutral-600',
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-emerald-100 text-emerald-700',
    accent: 'bg-accent-soft text-accent',
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1 transition-all hover:bg-white/80 hover:shadow-sm group"
    >
      <div className="w-8 h-8 rounded-full bg-brand-text/5 flex items-center justify-center text-xs font-bold text-brand-muted group-hover:bg-accent-soft group-hover:text-accent transition-colors">
        {business.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-brand-text truncate">{business}</div>
        {detail && <div className="text-xs text-brand-muted truncate">{detail}</div>}
      </div>
      {badge && (
        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${badgeColors[badgeColor]}`}>
          {badge}
        </span>
      )}
    </Link>
  )
}

function CalendarRow({
  href,
  summary,
  time,
}: {
  href: string
  summary: string
  time: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1 transition-all hover:bg-white/80 hover:shadow-sm group"
    >
      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm group-hover:bg-blue-200 transition-colors">
        📅
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-brand-text truncate">{summary}</div>
        <div className="text-xs text-brand-muted">{time}</div>
      </div>
    </a>
  )
}

type SectionVariant = 'followups' | 'attention' | 'calendar'

const sectionStyles: Record<SectionVariant, { icon: string; accent: string; bg: string; iconBg: string }> = {
  followups: {
    icon: '📞',
    accent: 'border-l-accent',
    bg: 'bg-gradient-to-br from-accent-soft/30 to-white',
    iconBg: 'bg-accent-soft',
  },
  attention: {
    icon: '⚡',
    accent: 'border-l-orange-500',
    bg: 'bg-gradient-to-br from-orange-50/50 to-white',
    iconBg: 'bg-orange-100',
  },
  calendar: {
    icon: '📅',
    accent: 'border-l-blue-500',
    bg: 'bg-gradient-to-br from-blue-50/50 to-white',
    iconBg: 'bg-blue-100',
  },
}

function Section({
  title,
  count,
  empty,
  variant,
  children,
  className = '',
}: {
  title: string
  count: number
  empty: string
  variant: SectionVariant
  children: React.ReactNode
  className?: string
}) {
  const styles = sectionStyles[variant]
  return (
    <section
      className={`rounded-2xl border-l-4 ${styles.accent} ${styles.bg} p-5 transition-shadow hover:shadow-md ${className}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-xl ${styles.iconBg} w-10 h-10 rounded-xl flex items-center justify-center`}>
          {styles.icon}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-brand-text">{title}</h2>
          {count > 0 && (
            <p className="text-xs text-brand-muted">{count} item{count !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>
      {children || (
        <p className="text-sm text-brand-dim italic pl-[52px]">{empty}</p>
      )}
    </section>
  )
}

export default function TodayBoard() {
  const [board, setBoard] = useState<MarketingToday | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/today')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (data?.code === 'SESSION_EXPIRED') return
          setError(typeof data.error === 'string' ? data.error : 'Could not load today.')
          return
        }
        if (data.kind !== 'marketing') {
          setError('Open Credit & Funding for the credit queue.')
          return
        }
        setBoard(data)
      } catch {
        setError('Could not load today.')
      }
    })()
  }, [])

  if (error) return <p className="text-sm text-brand-red">{error}</p>
  if (!board) {
    return (
      <div className="flex items-center gap-3 text-brand-muted">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading your day…</span>
      </div>
    )
  }

  const meetings = board.meetings || []
  const showMeetings = board.role === 'sales_closer' || board.role === 'admin'
  const totalItems = board.followUps.length + board.handoffs.length + board.calendarEvents.length

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-1">Today</h1>
        <p className="text-sm text-brand-muted">
          Follow-ups, handoffs, meetings, and the sales calendar for the marketing pipeline.
        </p>
      </div>

      {board.metrics.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 p-4 rounded-2xl bg-gradient-to-r from-neutral-50 to-white border border-brand-border/50">
          {board.metrics.map((metric, i) => (
            <QuickStat key={metric.label} label={metric.label} value={metric.value} highlight={i === 0} />
          ))}
        </div>
      )}

      {!board.workspaceConnected && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50/50 border border-amber-200/50 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-sm text-amber-800">
            Google Calendar is not connected. Follow-up dates stay in the CRM only.
          </p>
        </div>
      )}

      {showMeetings && (
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-blue-50/70 to-white border border-blue-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center">🎥</span>
            <div>
              <h2 className="font-semibold text-brand-text">Meetings</h2>
              <p className="text-xs text-brand-muted">Open the Google Meet after it is scheduled</p>
            </div>
          </div>
          <MeetingJoinList
            meetings={meetings}
            showBusiness
            empty="When a meeting is scheduled, the Join button shows up here."
          />
        </section>
      )}

      {board.role === 'sales_closer' && (
        <section className="mb-6 rounded-2xl bg-gradient-to-br from-accent-soft/60 to-accent-soft/20 border border-accent/10 p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl bg-accent/10 w-10 h-10 rounded-xl flex items-center justify-center">💳</span>
            <div>
              <h2 className="font-semibold text-brand-text">Bill active clients</h2>
              <p className="text-xs text-brand-muted">Start subscriptions for closed deals</p>
            </div>
          </div>
          {(board.billable || []).length === 0 ? (
            <p className="text-sm text-brand-muted pl-[52px]">Move a deal to Active, then bill it here.</p>
          ) : (
            <div className="space-y-3 mt-2">
              {(board.billable || []).map((deal) => (
                <CloserBilling
                  key={deal.id}
                  prospectId={deal.id}
                  business={deal.business}
                  servicesPurchased={deal.servicesPurchased}
                  paymentStatus={deal.paymentStatus}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {totalItems === 0 && meetings.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-gradient-to-br from-accent-soft/20 to-white border border-dashed border-brand-border">
          <div className="text-4xl mb-3">✨</div>
          <h2 className="text-lg font-bold text-brand-text mb-1">All caught up!</h2>
          <p className="text-sm text-brand-muted">Nothing needs your attention right now.</p>
        </div>
      ) : totalItems > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section
            title="Follow-ups"
            count={board.followUps.length}
            variant="followups"
            empty="No follow-ups due this week."
          >
            {board.followUps.length > 0 && (
              <div className="space-y-1">
                {board.followUps.map((row) => (
                  <DealRow
                    key={row.id}
                    href={`/admin/pipeline/${row.id}`}
                    business={row.business}
                    detail={STAGE_LABELS[row.stage]}
                    badge={formatWhen(row.followUpAt) || undefined}
                    badgeColor="accent"
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Needs Attention"
            count={board.handoffs.length}
            variant="attention"
            empty="Nothing is waiting on a handoff."
          >
            {board.handoffs.length > 0 && (
              <div className="space-y-1">
                {board.handoffs.map((row) => (
                  <DealRow
                    key={row.id}
                    href={row.href}
                    business={row.business}
                    badge={STAGE_LABELS[row.stage]}
                    badgeColor="orange"
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Today's Calendar"
            count={board.calendarEvents.length}
            variant="calendar"
            empty="No events on the sales calendar today."
            className="lg:col-span-2"
          >
            {board.calendarEvents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {board.calendarEvents.map((event) => (
                  <CalendarRow
                    key={event.id}
                    href={event.htmlLink || '#'}
                    summary={event.summary}
                    time={formatWhen(event.start)}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      ) : null}
    </div>
  )
}
