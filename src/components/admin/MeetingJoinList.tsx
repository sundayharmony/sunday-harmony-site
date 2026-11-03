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
        const href = safeMeetHref(meeting.meetLink)
        const when = formatMeetingWhen(meeting.startsAt)
        return (
          <li
            key={meeting.id}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              {showBusiness && (
                <p className="text-sm font-medium text-brand-text truncate">{meeting.business || meeting.title}</p>
              )}
              <p className="text-xs text-brand-muted">{when || meeting.title}</p>
            </div>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full sm:w-auto items-center justify-center px-4 py-2.5 text-sm font-semibold bg-brand-text text-white rounded-lg hover:opacity-90"
              >
                Join meeting
              </a>
            ) : (
              <p className="text-xs text-brand-muted">Meet link is not available yet.</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
