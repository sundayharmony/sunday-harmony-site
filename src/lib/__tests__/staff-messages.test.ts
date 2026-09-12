import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  isSafeHttpUrl,
  safeHttpHref,
  splitMessageTextParts,
  staffMessageSetupError,
  STAFF_MESSAGES_SETUP_ERROR,
} from '../message-text'
import { pickStaffSenderId } from '../staff-sender'

const STAFF_ID = '123e4567-e89b-42d3-a456-426614174000'
const OTHER_STAFF_ID = '223e4567-e89b-42d3-a456-426614174000'
const CLIENT_ID = '323e4567-e89b-42d3-a456-426614174000'

describe('team chat message text', () => {
  it('linkifies http(s) URLs including funding widget links', () => {
    const url =
      'https://apileadconnectorhq.com/widget/form/t7zfkmNUoovUTFMNlihh?param_id=maccesar2918'
    const parts = splitMessageTextParts(`Link for funding app ${url}`)
    assert.deepEqual(parts, [
      { type: 'text', value: 'Link for funding app ' },
      { type: 'link', value: url },
    ])
  })

  it('keeps trailing punctuation out of the href', () => {
    const parts = splitMessageTextParts('See https://example.com/path.')
    assert.deepEqual(parts, [
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://example.com/path' },
      { type: 'text', value: '.' },
    ])
  })

  it('rejects non-http schemes', () => {
    assert.equal(isSafeHttpUrl('javascript:alert(1)'), false)
    assert.equal(safeHttpHref('javascript:alert(1)'), null)
    assert.equal(isSafeHttpUrl('https://sundayharmony.com/admin'), true)
    assert.equal(safeHttpHref('https://sundayharmony.com/admin'), 'https://sundayharmony.com/admin')
    const parts = splitMessageTextParts('click javascript:alert(1)')
    assert.deepEqual(parts, [{ type: 'text', value: 'click javascript:alert(1)' }])
  })
})

describe('staff_messages setup errors', () => {
  it('maps missing-table Postgres and PostgREST codes to a setup message', () => {
    assert.equal(staffMessageSetupError({ code: '42P01' }), STAFF_MESSAGES_SETUP_ERROR)
    assert.equal(staffMessageSetupError({ code: 'PGRST205' }), STAFF_MESSAGES_SETUP_ERROR)
    assert.equal(
      staffMessageSetupError({
        message: 'Could not find the table \'public.staff_messages\' in the schema cache',
      }),
      STAFF_MESSAGES_SETUP_ERROR
    )
    assert.equal(staffMessageSetupError({ code: '23503' }), null)
    assert.equal(staffMessageSetupError(null), null)
  })
})

describe('staff sender resolution', () => {
  it('uses the session user id when that row is staff', () => {
    assert.equal(
      pickStaffSenderId({
        sessionUserId: STAFF_ID,
        userById: { id: STAFF_ID, role: 'admin' },
        userByEmail: { id: OTHER_STAFF_ID, role: 'credit_manager' },
      }),
      STAFF_ID
    )
  })

  it('falls back to the email match when the JWT id is missing or not staff', () => {
    assert.equal(
      pickStaffSenderId({
        sessionUserId: 'not-a-uuid',
        userByEmail: { id: OTHER_STAFF_ID, role: 'credit_manager' },
      }),
      OTHER_STAFF_ID
    )
    assert.equal(
      pickStaffSenderId({
        sessionUserId: CLIENT_ID,
        userById: { id: CLIENT_ID, role: 'client' },
        userByEmail: { id: OTHER_STAFF_ID, role: 'admin' },
      }),
      OTHER_STAFF_ID
    )
  })

  it('rejects client-only accounts', () => {
    assert.equal(
      pickStaffSenderId({
        sessionUserId: CLIENT_ID,
        userById: { id: CLIENT_ID, role: 'client' },
        userByEmail: { id: CLIENT_ID, role: 'client' },
      }),
      null
    )
  })
})

describe('staff-messages API wiring', () => {
  it('returns mapped errors instead of a generic send failure', () => {
    const route = readFileSync('src/app/api/admin/staff-messages/route.ts', 'utf8')
    assert.match(route, /requireStaffSession/)
    assert.match(route, /resolveStaffSenderId/)
    assert.match(route, /result\.messages/)
    assert.match(route, /result\.error/)
    assert.match(route, /rateLimitDurable/)
    assert.doesNotMatch(route, /Failed to send message['"]/)
    assert.doesNotMatch(route, /getServerSession\(/)
  })

  it('surfaces API errors and linkifies team chat text', () => {
    const page = readFileSync('src/app/admin/team-messages/page.tsx', 'utf8')
    const db = readFileSync('src/lib/db.ts', 'utf8')
    assert.match(page, /splitMessageTextParts/)
    assert.match(page, /safeHttpHref/)
    assert.match(page, /<textarea/)
    assert.match(page, /\/admin\/messages/)
    assert.match(page, /apiErrorMessage/)
    assert.match(db, /resolveStaffSenderId/)
    assert.match(db, /staffMessageSetupError/)
    assert.match(db, /ok: false/)
  })
})
