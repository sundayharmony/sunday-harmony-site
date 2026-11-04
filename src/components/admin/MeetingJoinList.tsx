'use client'

import Link from 'next/link'
import { formatMeetingWhen, safeMeetHref, type JoinableMeeting } from '@/lib/joinable-meetings'

export default function MeetingJoinList({
  meetings,
  empty,
  showBusiness = false,
}: {
  meetings: JoinableMeeting[]
  empty?: string
  showBusiness?: boolean
}) {
  if (meetings.length === 0) {
    return empty ? <p className="text-sm text-brand-muted">{empty}</p> : null
  }

  return (
    <ul className="space-y-3">
      {meetings.map((meeting) => {
        const meetHref = safeMeetHref(meeting.meetLink)
        const calendarHref = safeMeetHref(meeting.calendarLink || '')
        const when = formatMeetingWhen(meeting.startsAt)
        const buttonClass = 'inline-flex w-full sm:w-auto items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-lg'
        return (
          <li
            key={`${meeting.prospectId}-${meeting.id}`}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              {showBusiness && (
                <p className="text-sm font-medium text-brand-text truncate">{meeting.business || meeting.title}</p>
              )}
              <p className="text-xs text-brand-muted">{when || meeting.title}</p>
            </div>
            {meetHref ? (
              <a href={meetHref} target="_blank" rel="noreferrer" className={`${buttonClass} bg-brand-text text-white hover:opacity-90`}>
                Join meeting
              </a>
            ) : calendarHref ? (
              <a href={calendarHref} target="_blank" rel="noreferrer" className={`${buttonClass} bg-brand-text text-white hover:opacity-90`}>
                Open in Calendar
              </a>
            ) : meeting.prospectId ? (
              <Link href={`/admin/pipeline/${meeting.prospectId}`} className={`${buttonClass} border border-brand-border text-brand-text`}>
                Open meeting
              </Link>
            ) : (
              <p className="text-xs text-brand-muted">Meet link is not available yet.</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
