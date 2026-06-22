'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import ContactProfileHeader from '@/components/crm/ContactProfileHeader'
import ActivityTimeline from '@/components/crm/ActivityTimeline'
import StatusBadge from '@/components/ui/StatusBadge'
import { MEETING_TYPE_LABELS, type MeetingType } from '@/lib/crm-types'
import type { ContactProfileSummary, ClientMeeting } from '@/lib/crm-db'
import type { ActivityLog } from '@/lib/db'

interface ContactData {
  profile: ContactProfileSummary
  meetings: ClientMeeting[]
  activity: ActivityLog[]
  messages: { id: string; from_name: string; text: string; created_at: string }[]
  files: { id: string; name: string; file_url: string; created_at: string }[]
  applicationDocs: { id: string; file_name: string; document_type: string; created_at: string }[]
  commHistory: { id: string; from_name: string; text: string; created_at: string }[]
  statusHistory: { status: string; notes?: string; created_at: string }[]
}

export default function ContactDetailPage() {
  const routeParams = useParams()
  const entityParam = routeParams.entity
  const idParam = routeParams.id
  const entity = entityParam === 'client' ? 'client' : 'lead'
  const contactId = typeof idParam === 'string' ? idParam : Array.isArray(idParam) ? idParam[0] : ''

  const [data, setData] = useState<ContactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    meeting_type: 'consultation' as MeetingType,
    scheduled_at: '',
    duration_minutes: 30,
    notes: '',
    google_meet_link: '',
  })
  const [scheduling, setScheduling] = useState(false)

  useEffect(() => {
    if (!contactId) return
    const load = async () => {
      try {
        const r = await fetch(`/api/admin/crm/contacts/${entity}/${contactId}`)
        if (!r.ok) throw new Error('Contact not found')
        setData(await r.json())
      } catch (err) {
        setError('Failed to load contact')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [entity, contactId])

  const scheduleMeeting = async () => {
    if (!data || !scheduleForm.title || !scheduleForm.scheduled_at) return
    setScheduling(true)
    try {
      const body: Record<string, unknown> = {
        title: scheduleForm.title,
        meeting_type: scheduleForm.meeting_type,
        scheduled_at: new Date(scheduleForm.scheduled_at).toISOString(),
        duration_minutes: scheduleForm.duration_minutes,
        notes: scheduleForm.notes,
        google_meet_link: scheduleForm.google_meet_link || undefined,
        application_uuid: data.profile.application?.id,
      }
      if (entity === 'client') body.client_id = contactId
      else body.lead_id = contactId

      const r = await fetch('/api/admin/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error('Failed to schedule')
      const meeting = await r.json()
      setData((prev) =>
        prev ? { ...prev, meetings: [meeting, ...prev.meetings], activity: prev.activity } : prev
      )
      setShowSchedule(false)
      setScheduleForm({ title: '', meeting_type: 'consultation', scheduled_at: '', duration_minutes: 30, notes: '', google_meet_link: '' })
      const reload = await fetch(`/api/admin/crm/contacts/${entity}/${contactId}`)
      if (reload.ok) setData(await reload.json())
    } catch (err) {
      console.error(err)
      setError('Failed to schedule meeting')
    } finally {
      setScheduling(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-brand-dim">Loading contact...</div>
  }
  if (!data) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error || 'Contact not found'}</p>
        <Link href="/admin/crm" className="text-accent text-sm mt-2 inline-block">← Back to CRM</Link>
      </div>
    )
  }

  const { profile, meetings, activity, messages, files, applicationDocs, commHistory, statusHistory } = data

  return (
    <div>
      <Link href="/admin/crm" className="text-xs text-accent hover:underline mb-4 inline-block">← CRM Overview</Link>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <ContactProfileHeader profile={profile} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-brand-text">Meetings</h2>
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className="px-3 py-1.5 rounded-lg bg-brand-text text-white text-xs font-bold"
            >
              Schedule Meeting
            </button>
          </div>

          {showSchedule && (
            <div className="mb-4 p-3 rounded-lg bg-neutral-50 border border-brand-border space-y-2">
              <input
                placeholder="Meeting title"
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm"
              />
              <select
                value={scheduleForm.meeting_type}
                onChange={(e) => setScheduleForm((f) => ({ ...f, meeting_type: e.target.value as MeetingType }))}
                className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm"
              >
                {Object.entries(MEETING_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={scheduleForm.scheduled_at}
                onChange={(e) => setScheduleForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm"
              />
              <input
                placeholder="Google Meet link (optional — auto-generated if blank)"
                value={scheduleForm.google_meet_link}
                onChange={(e) => setScheduleForm((f) => ({ ...f, google_meet_link: e.target.value }))}
                className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm"
              />
              <textarea
                placeholder="Notes"
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full py-2 px-3 border border-brand-border rounded-lg text-sm resize-y"
              />
              <button
                onClick={() => void scheduleMeeting()}
                disabled={scheduling}
                className="px-4 py-2 rounded-lg bg-accent-soft border border-accent text-accent text-xs font-semibold disabled:opacity-50"
              >
                {scheduling ? 'Scheduling…' : 'Confirm'}
              </button>
            </div>
          )}

          {meetings.length === 0 ? (
            <p className="text-sm text-brand-dim">No meetings scheduled.</p>
          ) : (
            <div className="space-y-2">
              {meetings.map((m) => (
                <div key={m.id} className="p-3 rounded-lg border border-brand-border bg-neutral-50">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm font-medium text-brand-text">{m.title}</span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="text-xs text-brand-muted mt-1">
                    {MEETING_TYPE_LABELS[m.meeting_type]} · {new Date(m.scheduled_at).toLocaleString()}
                  </div>
                  {m.google_meet_link && (
                    <a href={m.google_meet_link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline mt-1 inline-block">
                      Join Meet
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-brand-text mb-4">Activity Timeline</h2>
          <ActivityTimeline items={activity} />
        </div>

        <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-brand-text mb-4">Communication History</h2>
          {[...messages, ...commHistory].length === 0 ? (
            <p className="text-sm text-brand-dim">No messages yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...messages, ...commHistory]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((m) => (
                  <div key={m.id} className="p-2 rounded-lg bg-neutral-50 border border-brand-border">
                    <div className="text-xs font-semibold text-brand-text">{m.from_name}</div>
                    <div className="text-sm text-brand-muted">{m.text}</div>
                    <div className="text-[10px] text-brand-dim">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-brand-text mb-4">Documents</h2>
          {files.length === 0 && applicationDocs.length === 0 ? (
            <p className="text-sm text-brand-dim">No documents on file.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {files.map((f) => (
                <li key={f.id}>
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {f.name}
                  </a>
                  <span className="text-xs text-brand-dim ml-2">{new Date(f.created_at).toLocaleDateString()}</span>
                </li>
              ))}
              {applicationDocs.map((d) => (
                <li key={d.id} className="text-brand-muted">
                  {d.file_name} <span className="text-xs text-brand-dim">({d.document_type.replace(/_/g, ' ')})</span>
                </li>
              ))}
            </ul>
          )}
          {profile.application && (
            <Link
              href={`/admin/credit-funding?id=${profile.application.id}`}
              className="text-xs text-accent hover:underline mt-3 inline-block"
            >
              View Credit & Funding Application →
            </Link>
          )}
        </div>

        {statusHistory.length > 0 && (
          <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-bold text-brand-text mb-4">Application Status History</h2>
            <div className="space-y-2">
              {statusHistory.map((h, i) => (
                <div key={i} className="flex gap-3 items-center text-sm">
                  <StatusBadge status={h.status} />
                  <span className="text-brand-muted">{h.notes}</span>
                  <span className="text-xs text-brand-dim ml-auto">{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.notes && (
          <div className="bg-white border border-brand-border rounded-xl p-5 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-bold text-brand-text mb-2">Notes</h2>
            <p className="text-sm text-brand-muted whitespace-pre-wrap">{profile.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
