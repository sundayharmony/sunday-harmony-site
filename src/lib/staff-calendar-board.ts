import { listScheduledBookings } from '@/lib/consultation-db'
import { getAllMeetings } from '@/lib/crm-db'
import {
  isGoogleWorkspaceConfigured,
  listWorkspaceEvents,
  type WorkspaceCalendarEvent,
} from '@/lib/google-workspace'
import { assembleJoinableMeetings, type MeetingProspectRef } from '@/lib/joinable-meetings'
import { listMarketingProspects, roleMayUsePipeline } from '@/lib/marketing-crm'
import { roleMayOpenProspectFile } from '@/lib/marketing-pipeline'
import {
  mergeStaffCalendarEvents,
  type CalendarRange,
  type StaffCalendarEvent,
  type StaffCalendarSourceStatus,
} from '@/lib/staff-calendar'
import { listStaffTodos } from '@/lib/staff-todos'

export type StaffCalendarBoard = {
  timezone: string
  from: string
  to: string
  workspaceConnected: boolean
  events: StaffCalendarEvent[]
  sources: {
    meetings: StaffCalendarSourceStatus
    todos: StaffCalendarSourceStatus
    google: StaffCalendarSourceStatus
  }
}

function meetingRefs(
  prospects: Array<{
    id: string
    business: string
    stage?: string
    followUpAt?: string | null
    followUpEventId?: string | null
  }>
): MeetingProspectRef[] {
  return prospects.map((prospect) => ({
    id: prospect.id,
    business: prospect.business,
    stage: prospect.stage,
    followUpAt: prospect.followUpAt,
    followUpEventId: prospect.followUpEventId,
  }))
}

export async function loadStaffCalendarBoard(input: {
  viewer: { id: string; role?: string | null }
  range: CalendarRange
}): Promise<StaffCalendarBoard> {
  const role = input.viewer.role || null
  const workspaceConnected = isGoogleWorkspaceConfigured()
  const sources: StaffCalendarBoard['sources'] = {
    meetings: 'skipped',
    todos: 'ok',
    google: workspaceConnected ? 'ok' : 'disconnected',
  }

  let meetingRows: ReturnType<typeof assembleJoinableMeetings> = []
  let googleEvents: WorkspaceCalendarEvent[] = []
  let todos: Awaited<ReturnType<typeof listStaffTodos>> = []

  const todoTask = listStaffTodos({
    viewerId: input.viewer.id,
    viewerRole: role,
    status: 'all',
    limit: 200,
  }).then((rows) => {
    todos = rows
    sources.todos = 'ok'
  }).catch((error) => {
    console.error('staff calendar todos error:', error)
    sources.todos = 'error'
    todos = []
  })

  const googleTask = (async () => {
    if (role === 'credit_manager') {
      sources.google = 'skipped'
      return
    }
    if (!workspaceConnected) {
      sources.google = 'disconnected'
      return
    }
    try {
      googleEvents = await listWorkspaceEvents({
        timeMin: input.range.from.toISOString(),
        timeMax: input.range.to.toISOString(),
        maxResults: 100,
      })
      sources.google = 'ok'
    } catch (error) {
      console.error('staff calendar google error:', error)
      sources.google = 'error'
      googleEvents = []
    }
  })()

  await Promise.all([todoTask, googleTask])

  if (!roleMayUsePipeline(role)) {
    sources.meetings = 'skipped'
  } else {
    try {
      const prospects = await listMarketingProspects(role)
      const visible = new Set(prospects.map((row) => row.id))
      const [stored, bookings] = await Promise.all([
        getAllMeetings().catch(() => []),
        listScheduledBookings().catch(() => []),
      ])
      meetingRows = assembleJoinableMeetings({
        prospects: meetingRefs(prospects),
        meetings: stored.filter((row) => row.lead_id && visible.has(row.lead_id)),
        bookings: bookings.filter((row) => row.lead_id && visible.has(row.lead_id)),
        calendarEvents: googleEvents,
        includeEnded: true,
        rangeStartMs: input.range.from.getTime(),
        rangeEndMs: input.range.to.getTime(),
      })
      sources.meetings = 'ok'
    } catch (error) {
      console.error('staff calendar meetings error:', error)
      sources.meetings = 'error'
      meetingRows = []
    }
  }

  const events = mergeStaffCalendarEvents({
    meetings: meetingRows.map((row) => ({
      id: row.id,
      prospectId: row.prospectId,
      business: row.business,
      title: row.title,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      durationMinutes: row.durationMinutes,
      meetLink: row.meetLink,
      calendarLink: row.calendarLink,
    })),
    googleEvents: role === 'credit_manager' ? [] : googleEvents,
    todos,
    role,
    range: input.range,
  })

  if (!roleMayOpenProspectFile(role)) {
    for (const event of events) {
      if (event.kind === 'meeting') event.prospectId = null
    }
  }

  return {
    timezone: 'America/New_York',
    from: input.range.from.toISOString(),
    to: input.range.to.toISOString(),
    workspaceConnected,
    events,
    sources,
  }
}
