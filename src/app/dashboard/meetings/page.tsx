'use client'

import { useState, useEffect } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'
import { MEETING_TYPE_LABELS } from '@/lib/crm-types'
import type { ClientMeeting } from '@/lib/crm-db'

export default function ClientMeetingsPage() {
  const [upcoming, setUpcoming] = useState<ClientMeeting[]>([])
  const [previous, setPrevious] = useState<ClientMeeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/meetings')
      .then((r) => r.json())
      .then((d) => {
        setUpcoming(d.upcoming || [])
        setPrevious(d.previous || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const MeetingCard = ({ m }: { m: ClientMeeting }) => (
    <div className="p-4 rounded-xl bg-white border border-brand-border shadow-sm">
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="text-sm font-bold text-brand-text">{m.title}</h3>
        <StatusBadge status={m.status} />
      </div>
      <div className="text-xs text-brand-muted space-y-1">
        <p>{MEETING_TYPE_LABELS[m.meeting_type] || m.meeting_type}</p>
        <p>{new Date(m.scheduled_at).toLocaleString()} · {m.duration_minutes} min</p>
        {m.assigned_staff && <p>Specialist: {m.assigned_staff}</p>}
        {m.notes && <p className="text-brand-dim mt-2">{m.notes}</p>}
      </div>
      {m.google_meet_link && m.status === 'scheduled' && (
        <a
          href={m.google_meet_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 px-4 py-2 rounded-lg bg-brand-text text-white text-xs font-bold hover:opacity-90"
        >
          Join Google Meet
        </a>
      )}
    </div>
  )

  if (loading) {
    return <div className="p-8 text-center text-brand-dim">Loading meetings...</div>
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">My Meetings</h1>
        <p className="text-sm text-brand-muted">Upcoming consultations and past sessions with your Sunday Harmony team.</p>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-bold text-brand-text mb-4">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-brand-dim p-4 rounded-xl bg-neutral-50 border border-brand-border">
            No upcoming meetings. Your specialist will schedule sessions here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold text-brand-text mb-4">Previous</h2>
        {previous.length === 0 ? (
          <p className="text-sm text-brand-dim">No past meetings yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {previous.map((m) => <MeetingCard key={m.id} m={m} />)}
          </div>
        )}
      </section>
    </div>
  )
}
