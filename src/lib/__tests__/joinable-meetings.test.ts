import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { assembleJoinableMeetings, isGoogleMeetHref, meetingStillJoinable, safeMeetHref } from '../joinable-meetings'
import { prospectMeetingCardState } from '../prospect-sales-cards'

describe('joinable meetings', () => {
  it('keeps a meeting joinable until 15 minutes after it ends', () => {
    const now = Date.parse('2026-11-02T15:00:00.000Z')
    assert.equal(meetingStillJoinable({ startsAt: '2026-11-02T16:00:00.000Z', durationMinutes: 30 }, now), true)
    assert.equal(meetingStillJoinable({ startsAt: '2026-11-02T14:20:00.000Z', durationMinutes: 30 }, now), true)
    assert.equal(meetingStillJoinable({ startsAt: '2026-11-02T14:00:00.000Z', durationMinutes: 30 }, now), false)
    assert.equal(meetingStillJoinable({ startsAt: '2026-11-02T14:00:00.000Z', endsAt: '2026-11-02T14:50:00.000Z' }, now), true)
    assert.equal(safeMeetHref('https://meet.google.com/abc-defg-hij'), 'https://meet.google.com/abc-defg-hij')
    assert.equal(safeMeetHref('http://meet.google.com/abc'), null)
    assert.equal(isGoogleMeetHref('https://meet.google.com/abc-defg-hij'), true)
    assert.equal(isGoogleMeetHref('https://calendar.google.com/event?eid=abc'), false)
    assert.equal(isGoogleMeetHref(''), false)
  })

  it('hides outreach from sales closers and offers a join link', () => {
    const prospect = readFileSync('src/components/admin/ProspectFile.tsx', 'utf8')
    const today = readFileSync('src/components/admin/TodayBoard.tsx', 'utf8')
    const pipeline = readFileSync('src/components/admin/MarketingPipeline.tsx', 'utf8')
    const join = readFileSync('src/components/admin/MeetingJoinList.tsx', 'utf8')
    assert.match(prospect, /const showOutreach = role === 'admin' \|\| isProcurement/)
    assert.match(prospect, /MeetingJoinList/)
    assert.match(prospect, /The Meet link shows here once the consultation is booked\./)
    assert.match(today, /MeetingJoinList/)
    assert.match(today, /Open the Google Meet after it is scheduled/)
    assert.match(pipeline, /Join meeting/)
    assert.match(pipeline, /Open in Calendar/)
    assert.match(pipeline, /w-full items-center/)
    assert.match(join, /Join meeting/)
    assert.match(join, /w-full sm:w-auto/)
  })

  it('joins a scheduled meeting from the calendar event when no Meet row was saved', () => {
    const now = Date.parse('2026-11-02T15:00:00.000Z')
    const startsAt = '2026-11-04T16:00:00.000Z'
    const rows = assembleJoinableMeetings({
      now,
      includeUnmatchedCalendar: true,
      prospects: [{
        id: 'lead-1',
        business: 'Lumen & Co. Floral',
        stage: 'meeting_scheduled',
        followUpAt: startsAt,
        followUpEventId: 'evt-meet',
      }],
      meetings: [],
      bookings: [],
      calendarEvents: [{
        id: 'evt-meet',
        summary: 'Meeting: Lumen & Co. Floral',
        start: startsAt,
        end: '2026-11-04T16:30:00.000Z',
        htmlLink: 'https://calendar.google.com/event?eid=evt-meet',
        meetLink: 'https://meet.google.com/lumen-live',
      }, {
        id: 'evt-other',
        summary: 'Consultation with someone else',
        start: '2026-11-05T16:00:00.000Z',
        htmlLink: 'https://calendar.google.com/event?eid=evt-other',
        meetLink: 'https://meet.google.com/other-live',
      }, {
        id: 'evt-follow',
        summary: 'Follow up: Lumen & Co. Floral',
        start: '2026-11-06T16:00:00.000Z',
        htmlLink: 'https://calendar.google.com/event?eid=evt-follow',
      }],
    })
    assert.equal(rows.filter((row) => row.prospectId === 'lead-1').length, 1)
    assert.equal(rows.find((row) => row.prospectId === 'lead-1')?.meetLink, 'https://meet.google.com/lumen-live')
    assert.equal(rows.some((row) => row.meetLink === 'https://meet.google.com/other-live'), true)
    assert.equal(rows.some((row) => row.id === 'evt-follow'), false)
  })

  it('keeps stored meeting history after the join cutoff without making it joinable', () => {
    const now = Date.parse('2026-11-05T18:00:00.000Z')
    const startsAt = '2026-11-05T16:00:00.000Z'
    const input = {
      now,
      prospects: [{
        id: 'lead-1',
        business: 'Lumen & Co. Floral',
        stage: 'proposal_sent',
        followUpAt: startsAt,
        followUpEventId: 'evt-past',
      }],
      meetings: [{
        id: 'm-past',
        lead_id: 'lead-1',
        status: 'scheduled',
        scheduled_at: startsAt,
        duration_minutes: 30,
        google_meet_link: 'https://meet.google.com/lumen-past',
        title: 'Meeting: Lumen & Co. Floral',
      }],
    }
    const joinable = assembleJoinableMeetings(input)
    const history = assembleJoinableMeetings({ ...input, includeEnded: true })
    assert.equal(joinable.length, 0)
    assert.equal(history.length, 1)
    assert.equal(history[0]?.startsAt, startsAt)
    assert.equal(meetingStillJoinable({ startsAt, durationMinutes: 30 }, now), false)
    assert.equal(prospectMeetingCardState({
      now,
      storedMeetings: input.meetings,
      followUpAt: startsAt,
      stage: 'proposal_sent',
    }).state, 'past')
  })
})
