import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  dedupeStaffCalendarEvents,
  instantAtNy,
  mergeStaffCalendarEvents,
  nyDateKey,
  parseCalendarRange,
  startOfNyWeek,
  weekDateKeys,
} from '../staff-calendar'
import { marketingRoleAllowedPath, navForRole } from '../marketing-pipeline'

describe('staff calendar timezone and range', () => {
  it('keeps America/New_York date keys across DST', () => {
    assert.equal(nyDateKey('2026-03-08T06:30:00.000Z'), '2026-03-08')
    assert.equal(nyDateKey('2026-03-08T07:30:00.000Z'), '2026-03-08')
    assert.equal(nyDateKey(instantAtNy('2026-03-08', 2, 30)), '2026-03-08')
    assert.equal(nyDateKey('2026-11-01T05:30:00.000Z'), '2026-11-01')
    assert.equal(nyDateKey('2026-11-01T06:30:00.000Z'), '2026-11-01')
  })

  it('starts weeks on Sunday in New York', () => {
    assert.equal(startOfNyWeek('2026-11-05'), '2026-11-01')
    assert.deepEqual(weekDateKeys('2026-11-05'), [
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ])
  })

  it('rejects missing, inverted, and oversized ranges', () => {
    assert.equal(parseCalendarRange(null, '2026-11-08').ok, false)
    assert.equal(parseCalendarRange('2026-11-08', '2026-11-01').ok, false)
    assert.equal(parseCalendarRange('2026-01-01', '2026-04-01').ok, false)
    const week = parseCalendarRange('2026-11-01', '2026-11-07')
    assert.equal(week.ok, true)
    if (week.ok) {
      assert.equal(week.range.fromKey, '2026-11-01')
      assert.ok(week.range.to.getTime() > week.range.from.getTime())
    }
  })
})

describe('staff calendar merge', () => {
  it('drops todos without a due date and omits done or cancelled todos', () => {
    const range = parseCalendarRange('2026-11-01', '2026-11-07')
    assert.equal(range.ok, true)
    if (!range.ok) return
    const events = mergeStaffCalendarEvents({
      range: range.range,
      todos: [
        { id: 'open', title: 'Call Maya', due_date: '2026-11-05', status: 'open' },
        { id: 'later', title: 'No date', due_date: null, status: 'open' },
        { id: 'done', title: 'Done', due_date: '2026-11-05', status: 'done' },
        { id: 'cancel', title: 'Cancel', due_date: '2026-11-05', status: 'cancelled' },
      ],
    })
    assert.deepEqual(events.map((event) => event.id), ['todo:open'])
    assert.equal(events[0]?.href, '/admin/todos?todo=open')
    assert.equal(events[0]?.allDay, true)
  })

  it('deduplicates stored meetings and Google copies of the same Meet', () => {
    const events = dedupeStaffCalendarEvents([
      {
        id: 'google:evt-1',
        kind: 'google',
        title: 'Meeting: Lumen',
        start: '2026-11-05T16:00:00.000Z',
        allDay: false,
        dateKey: '2026-11-05',
        href: 'https://calendar.google.com/event?eid=evt-1',
        meetLink: 'https://meet.google.com/lumen-join',
        calendarLink: 'https://calendar.google.com/event?eid=evt-1',
      },
      {
        id: 'meeting:m1',
        kind: 'meeting',
        title: 'Lumen & Co. Floral',
        start: '2026-11-05T16:00:00.000Z',
        allDay: false,
        dateKey: '2026-11-05',
        prospectId: 'lead-1',
        href: '/admin/pipeline/lead-1',
        meetLink: 'https://meet.google.com/lumen-join',
      },
    ])
    assert.equal(events.length, 1)
    assert.equal(events[0]?.kind, 'meeting')
    assert.equal(events[0]?.prospectId, 'lead-1')
    assert.equal(events[0]?.href, '/admin/pipeline/lead-1')
    assert.equal(events[0]?.calendarLink, 'https://calendar.google.com/event?eid=evt-1')
  })

  it('keeps pipeline links off the calendar for client relations', () => {
    const range = parseCalendarRange('2026-11-01', '2026-11-07')
    assert.equal(range.ok, true)
    if (!range.ok) return
    const events = mergeStaffCalendarEvents({
      role: 'client_relations',
      range: range.range,
      meetings: [{
        id: 'm1',
        prospectId: 'lead-1',
        title: 'Meeting: Lumen',
        startsAt: '2026-11-05T16:00:00.000Z',
        meetLink: 'https://meet.google.com/lumen-join',
      }],
    })
    assert.equal(events[0]?.prospectId, null)
    assert.equal(events[0]?.href, 'https://meet.google.com/lumen-join')
  })
})

describe('staff calendar access', () => {
  it('puts Calendar after Today for every Todos role', () => {
    const admin = navForRole('admin').map((item) => item.href)
    assert.equal(admin[0], '/admin')
    assert.equal(admin[1], '/admin/calendar')
    for (const role of ['admin', 'sales_closer', 'lead_procurement', 'client_relations', 'credit_manager']) {
      assert.equal(navForRole(role).some((item) => item.href === '/admin/calendar' && item.label === 'Calendar'), true)
      assert.equal(navForRole(role).some((item) => item.href === '/admin/todos'), true)
    }
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/calendar'), true)
    assert.equal(marketingRoleAllowedPath('lead_procurement', '/admin/calendar'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/calendar'), true)
    const api = readFileSync('src/app/api/admin/calendar/route.ts', 'utf8')
    const page = readFileSync('src/app/admin/calendar/page.tsx', 'utf8')
    const ui = readFileSync('src/components/admin/StaffCalendar.tsx', 'utf8')
    const middleware = readFileSync('src/middleware.ts', 'utf8')
    assert.match(api, /requireAnyStaffSession/)
    assert.match(api, /parseCalendarRange/)
    assert.match(page, /StaffCalendar/)
    assert.doesNotMatch(ui, /iframe/)
    assert.match(ui, /data-testid="calendar-week"/)
    assert.match(ui, /data-testid="calendar-agenda"/)
    assert.match(ui, /sm:hidden/)
    assert.match(middleware, /'\/admin\/calendar'/)
    const today = readFileSync('src/components/admin/TodayBoard.tsx', 'utf8')
    const todayApi = readFileSync('src/lib/marketing-crm.ts', 'utf8')
    assert.doesNotMatch(today, /Today's Calendar/)
    assert.doesNotMatch(todayApi, /today calendar error/)
  })
})
