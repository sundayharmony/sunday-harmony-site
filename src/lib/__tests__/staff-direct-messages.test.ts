import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { marketingRoleAllowedPath, navForRole } from '../marketing-pipeline'
import {
  canUseStaffDirectMessages,
  canonicalStaffThreadPair,
  clipStaffPreview,
  formatStaffMessageTime,
  otherStaffParticipant,
  staffDirectSendTarget,
  staffDirectUnread,
  staffRoleLabel,
  validateStaffDirectText,
  viewerMayReadStaffDirectThread,
} from '../staff-direct-messages'

const ADMIN = '123e4567-e89b-42d3-a456-426614174000'
const EXPERT = '223e4567-e89b-42d3-a456-426614174001'
const CLOSER = '323e4567-e89b-42d3-a456-426614174002'

describe('who can use staff messages', () => {
  it('allows every internal staff role and rejects clients and partners', () => {
    for (const role of ['admin', 'credit_manager', 'lead_procurement', 'sales_closer', 'client_relations']) {
      assert.equal(canUseStaffDirectMessages(role), true)
      assert.equal(navForRole(role).some((item) => item.href === '/admin/messages' && item.label === 'Messages'), true)
    }
    for (const role of ['client', 'partner', 'owner', '', null, undefined]) {
      assert.equal(canUseStaffDirectMessages(role), false)
      assert.equal(navForRole(role).some((item) => item.href === '/admin/messages'), false)
    }
    assert.equal(staffRoleLabel('credit_manager'), 'Credit expert')
    assert.equal(staffRoleLabel('sales_closer'), 'Sales closer')
    assert.equal(staffRoleLabel('client'), 'Staff')
    assert.equal(marketingRoleAllowedPath('lead_procurement', '/admin/messages'), true)
    assert.equal(marketingRoleAllowedPath('sales_closer', '/admin/messages'), true)
    assert.equal(marketingRoleAllowedPath('client_relations', '/admin/messages'), true)
  })

  it('links Messages from the shared admin sidebar for admin and credit managers', () => {
    const sidebar = readFileSync('src/components/admin/AdminSidebar.tsx', 'utf8')
    const pipeline = readFileSync('src/lib/marketing-pipeline.ts', 'utf8')
    const middleware = readFileSync('src/middleware.ts', 'utf8')
    const clientNav = readFileSync('src/components/dashboard/ClientSidebar.tsx', 'utf8')

    assert.match(sidebar, /navForRole/)
    assert.match(sidebar, /href=\{item\.href\}/)
    assert.equal(sidebar.match(/navItems\.map/g)?.length, 1)
    assert.equal(
      navForRole('admin').some((item) => item.href === '/admin/messages' && item.label === 'Messages'),
      true
    )
    assert.equal(
      navForRole('credit_manager').some((item) => item.href === '/admin/messages' && item.label === 'Messages'),
      true
    )
    const adminHrefs = navForRole('admin').map((item) => item.href)
    const expertHrefs = navForRole('credit_manager').map((item) => item.href)
    assert.ok(adminHrefs.indexOf('/admin/messages') < adminHrefs.indexOf('/admin/settings'))
    assert.ok(expertHrefs.indexOf('/admin/messages') < expertHrefs.indexOf('/admin/settings'))
    assert.ok(adminHrefs.includes('/admin/credit-funding'))
    assert.ok(expertHrefs.includes('/admin/credit-funding'))

    const navFn = pipeline.slice(
      pipeline.indexOf('export function navForRole'),
      pipeline.indexOf('export function homeForRole')
    )
    assert.match(navFn, /role === 'credit_manager'[\s\S]*\/admin\/messages/)
    assert.match(navFn, /role === 'admin'\) return ADMIN_NAV/)
    assert.match(pipeline, /href: '\/admin\/messages'/)
    assert.match(pipeline, /label: 'Messages'/)
    assert.match(middleware, /\/admin\/messages/)
    assert.doesNotMatch(clientNav, /\/admin\/messages/)
    assert.match(clientNav, /\/dashboard\/messages/)
  })
})

describe('staff thread membership', () => {
  it('keeps one thread per pair and hides it from everyone else', () => {
    const forward = canonicalStaffThreadPair(ADMIN, EXPERT)
    const backward = canonicalStaffThreadPair(EXPERT, ADMIN)
    assert.deepEqual(forward, backward)
    assert.equal(canonicalStaffThreadPair(ADMIN, ADMIN), null)
    assert.equal(canonicalStaffThreadPair(ADMIN, 'not-a-user'), null)
    assert.ok(forward)
    assert.equal(viewerMayReadStaffDirectThread(ADMIN, forward), true)
    assert.equal(viewerMayReadStaffDirectThread(EXPERT.toUpperCase(), forward), true)
    assert.equal(viewerMayReadStaffDirectThread(CLOSER, forward), false)
    assert.equal(viewerMayReadStaffDirectThread(ADMIN, null), false)
    assert.equal(otherStaffParticipant(ADMIN, forward), EXPERT)
    assert.equal(otherStaffParticipant(EXPERT, forward), ADMIN)
    assert.equal(otherStaffParticipant(CLOSER, forward), null)

    const target = staffDirectSendTarget(EXPERT, ADMIN)
    assert.equal(target.ok, true)
    if (target.ok) {
      assert.equal(viewerMayReadStaffDirectThread(CLOSER, target), false)
      assert.equal(viewerMayReadStaffDirectThread(EXPERT, target), true)
    }
    assert.deepEqual(staffDirectSendTarget(ADMIN, ADMIN), {
      ok: false,
      status: 400,
      error: 'Choose someone else on staff.',
    })
  })

  it('marks a thread unread only for the recipient', () => {
    assert.equal(
      staffDirectUnread({
        viewerId: EXPERT,
        lastSenderId: ADMIN,
        lastMessageAt: '2026-11-04T15:00:00.000Z',
        lastReadAt: null,
      }),
      true
    )
    assert.equal(
      staffDirectUnread({
        viewerId: EXPERT,
        lastSenderId: ADMIN,
        lastMessageAt: '2026-11-04T15:00:00.000Z',
        lastReadAt: '2026-11-04T14:00:00.000Z',
      }),
      true
    )
    assert.equal(
      staffDirectUnread({
        viewerId: EXPERT,
        lastSenderId: ADMIN,
        lastMessageAt: '2026-11-04T15:00:00.000Z',
        lastReadAt: '2026-11-04T15:05:00.000Z',
      }),
      false
    )
    assert.equal(
      staffDirectUnread({
        viewerId: ADMIN,
        lastSenderId: ADMIN,
        lastMessageAt: '2026-11-04T15:00:00.000Z',
        lastReadAt: null,
      }),
      false
    )
    assert.equal(clipStaffPreview('  hello   team  '), 'hello team')
    assert.equal(validateStaffDirectText('  ').ok, false)
    assert.equal(validateStaffDirectText('x'.repeat(10001)).ok, false)
  })

  it('shows message times in America/New_York', () => {
    const winter = formatStaffMessageTime('2026-01-15T17:05:00.000Z')
    const summer = formatStaffMessageTime('2026-07-04T16:30:00.000Z')
    assert.match(winter, /12:05/)
    assert.match(winter, /PM/)
    assert.doesNotMatch(winter, /5:05/)
    assert.match(summer, /12:30/)
    assert.match(summer, /PM/)
    assert.equal(formatStaffMessageTime('not-a-date'), '')
  })
})

describe('staff messages wiring', () => {
  it('checks the session and thread membership without touching client messages', () => {
    const route = readFileSync('src/app/api/admin/staff-direct-messages/route.ts', 'utf8')
    const db = readFileSync('src/lib/staff-direct-messages-db.ts', 'utf8')
    const page = readFileSync('src/app/admin/messages/page.tsx', 'utf8')
    const ui = readFileSync('src/components/admin/StaffDirectMessages.tsx', 'utf8')
    const clientApi = readFileSync('src/app/api/admin/messages/route.ts', 'utf8')
    const personFile = readFileSync('src/components/admin/PersonFile.tsx', 'utf8')
    const sql = readFileSync('supabase-migration-050-staff-messages.sql', 'utf8')
    const redirects = readFileSync('next.config.js', 'utf8')

    assert.match(route, /requireAnyStaffSession/)
    assert.match(route, /getStaffDirectThread/)
    assert.match(route, /sendStaffDirectMessage/)
    assert.doesNotMatch(route, /requireClientSession/)
    assert.match(db, /viewerMayReadStaffDirectThread/)
    assert.match(db, /canUseStaffDirectMessages/)
    assert.match(db, /Forbidden/)
    assert.match(page, /StaffDirectMessages/)
    assert.match(ui, /formatStaffMessageTime/)
    assert.match(ui, /No messages yet/)
    assert.match(ui, /← Staff/)
    assert.match(ui, /md:hidden/)
    assert.match(ui, /\/api\/admin\/staff-direct-messages/)
    assert.doesNotMatch(ui, /\/api\/admin\/messages['"`?]/)
    assert.match(clientApi, /clientId/)
    assert.doesNotMatch(clientApi, /staff_direct/)
    assert.match(personFile, /\/api\/admin\/messages/)
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
    assert.match(sql, /FORCE ROW LEVEL SECURITY/)
    assert.match(sql, /REVOKE ALL/)
    assert.match(sql, /sender is not a participant/)
    assert.match(sql, /staff direct threads are limited to internal staff/)
    assert.doesNotMatch(sql, /USING \(true\)/)
    assert.doesNotMatch(redirects, /source: '\/admin\/messages'/)
    assert.match(redirects, /source: '\/admin\/team-messages'/)
  })
})
