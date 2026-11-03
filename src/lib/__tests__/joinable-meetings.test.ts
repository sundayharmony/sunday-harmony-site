import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { meetingStillJoinable, safeMeetHref } from '../joinable-meetings'

describe('joinable meetings', () => {
  it('keeps a meeting joinable until 15 minutes after it ends', () => {
    const now = Date.parse('2026-11-02T15:00:00.000Z')
    assert.equal(meetingStillJoinable({ startsAt: '2026-11-02T16:00:00.000Z', durationMinutes: 30 }, now), true)
    assert.equal(meetingStillJoinable({ startsAt: '2026-11-02T14:20:00.000Z', durationMinutes: 30 }, now), true)
    assert.equal(meetingStillJoinable({ startsAt: '2026-11-02T14:00:00.000Z', durationMinutes: 30 }, now), false)
    assert.equal(meetingStillJoinable({ startsAt: '2026-11-02T14:00:00.000Z', endsAt: '2026-11-02T14:50:00.000Z' }, now), true)
    assert.equal(safeMeetHref('https://meet.google.com/abc-defg-hij'), 'https://meet.google.com/abc-defg-hij')
    assert.equal(safeMeetHref('http://meet.google.com/abc'), null)
  })

  it('hides outreach from sales closers and offers a join link', () => {
    const prospect = readFileSync('src/components/admin/ProspectFile.tsx', 'utf8')
    const today = readFileSync('src/components/admin/TodayBoard.tsx', 'utf8')
    const join = readFileSync('src/components/admin/MeetingJoinList.tsx', 'utf8')
    assert.match(prospect, /const showOutreach = role === 'admin' \|\| isProcurement/)
    assert.match(prospect, /MeetingJoinList/)
    assert.match(prospect, /The Meet link shows here once the consultation is booked\./)
    assert.match(today, /MeetingJoinList/)
    assert.match(today, /Open the Google Meet after it is scheduled/)
    assert.match(join, /Join meeting/)
    assert.match(join, /w-full sm:w-auto/)
  })
})
