import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { consultationEmailHtml } from '../consultation-email'
import { isGoogleCalendarConfigured } from '../google-calendar'
import {
  bookingsDueForReminder,
  buildConsultationSlots,
  type ConsultationSettings,
  type WeeklyWindow,
} from '../consultation-slots'

const settings: ConsultationSettings = {
  timezone: 'America/New_York',
  slotMinutes: 30,
  bufferMinutes: 0,
  windowDays: 1,
  minLeadMinutes: 120,
}

const thursdayHours: WeeklyWindow[] = [{ weekday: 4, startMinute: 10 * 60, endMinute: 11 * 60 }]

describe('consultation slots', () => {
  it('offers open times inside weekly hours and skips the lead-time gap', () => {
    const slots = buildConsultationSlots({
      now: new Date('2026-10-15T12:00:00.000Z'),
      settings,
      hours: thursdayHours,
      blackoutDates: [],
      busy: [],
    })
    assert.deepEqual(
      slots.map((slot) => slot.startsAt),
      ['2026-10-15T14:00:00.000Z', '2026-10-15T14:30:00.000Z']
    )
  })

  it('drops a blackout day and a slot that overlaps an existing booking', () => {
    const blocked = buildConsultationSlots({
      now: new Date('2026-10-15T12:00:00.000Z'),
      settings,
      hours: thursdayHours,
      blackoutDates: ['2026-10-15'],
      busy: [],
    })
    assert.equal(blocked.length, 0)

    const busy = buildConsultationSlots({
      now: new Date('2026-10-15T12:00:00.000Z'),
      settings,
      hours: thursdayHours,
      blackoutDates: [],
      busy: [{ startsAt: '2026-10-15T14:00:00.000Z', endsAt: '2026-10-15T14:30:00.000Z' }],
    })
    assert.deepEqual(
      busy.map((slot) => slot.startsAt),
      ['2026-10-15T14:30:00.000Z']
    )
  })
})

describe('consultation reminders', () => {
  const now = new Date('2026-10-16T15:00:00.000Z')

  it('includes meetings in the next 24 hours that were confirmed earlier', () => {
    const due = bookingsDueForReminder(
      [
        {
          id: 'soon',
          status: 'scheduled',
          reminderSentAt: null,
          confirmationSentAt: '2026-10-16T10:00:00.000Z',
          startsAt: '2026-10-17T14:00:00.000Z',
          meetLink: 'https://meet.google.com/abc-defg-hij',
        },
        {
          id: 'fresh',
          status: 'scheduled',
          reminderSentAt: null,
          confirmationSentAt: '2026-10-16T14:30:00.000Z',
          startsAt: '2026-10-16T18:00:00.000Z',
          meetLink: 'https://meet.google.com/abc-defg-hij',
        },
        {
          id: 'later',
          status: 'scheduled',
          reminderSentAt: null,
          confirmationSentAt: '2026-10-15T10:00:00.000Z',
          startsAt: '2026-10-18T14:00:00.000Z',
          meetLink: 'https://meet.google.com/abc-defg-hij',
        },
        {
          id: 'sent',
          status: 'scheduled',
          reminderSentAt: '2026-10-16T12:00:00.000Z',
          confirmationSentAt: '2026-10-15T10:00:00.000Z',
          startsAt: '2026-10-16T20:00:00.000Z',
          meetLink: 'https://meet.google.com/abc-defg-hij',
        },
      ],
      now
    )
    assert.deepEqual(due.map((row) => row.id), ['soon'])
  })
})

describe('consultation email and calendar gate', () => {
  it('uses the site theme and the real Meet link', () => {
    const html = consultationEmailHtml({
      kind: 'confirmation',
      audience: 'guest',
      greetingName: 'Ada',
      whenLabel: 'Thursday, October 15, 2026 at 10:00 AM EDT',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      cancelUrl: 'https://www.sundayharmony.com/contact/cancel?token=abc',
    })
    assert.match(html, /#f4efe5/)
    assert.match(html, /#b8943f/)
    assert.match(html, /#0a0a0a/)
    assert.match(html, /https:\/\/meet\.google\.com\/abc-defg-hij/)
    assert.match(html, /Join Google Meet/)
    assert.doesNotMatch(html, /meet\.google\.com\/[a-f0-9]{3}-[a-f0-9]{3}-[a-f0-9]{3}/)
  })

  it('refuses booking when calendar credentials are absent', () => {
    const keys = [
      'GOOGLE_CALENDAR_CLIENT_ID',
      'GOOGLE_CALENDAR_CLIENT_SECRET',
      'GOOGLE_CALENDAR_REFRESH_TOKEN',
      'GOOGLE_CALENDAR_ID',
    ] as const
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    for (const key of keys) delete process.env[key]
    try {
      assert.equal(isGoogleCalendarConfigured(), false)
    } finally {
      for (const key of keys) {
        if (previous[key] == null) delete process.env[key]
        else process.env[key] = previous[key]
      }
    }
  })

  it('wires the public book route, reminder cron, and contact page', () => {
    const book = readFileSync('src/app/api/consultations/route.ts', 'utf8')
    const reminders = readFileSync('src/app/api/internal/consultation-reminders/route.ts', 'utf8')
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons?: Array<{ path: string }> }
    const contact = readFileSync('src/app/contact/page.tsx', 'utf8')
    assert.match(book, /hasHoneypotValue/)
    assert.match(book, /rateLimitDurable/)
    assert.match(book, /bookConsultation/)
    assert.match(reminders, /Bearer \$\{cronSecret\}/)
    assert.equal(
      vercel.crons?.some((cron) => cron.path === '/api/internal/consultation-reminders'),
      true
    )
    assert.match(contact, /ConsultationBooker/)
    assert.match(contact, /id="book"/)
  })
})
