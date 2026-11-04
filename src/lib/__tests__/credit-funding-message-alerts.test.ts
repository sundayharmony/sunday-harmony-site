import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  clipMessagePreview,
  countUnreadApplicantMessages,
  formatUnreadBadgeCount,
} from '../credit-funding-message-alerts'

describe('credit funding message unread helpers', () => {
  it('counts applicant messages after the last-read watermark', () => {
    const messages = [
      { id: '1', from_role: 'admin', created_at: '2026-01-01T10:00:00.000Z' },
      { id: '2', from_role: 'applicant', created_at: '2026-01-01T11:00:00.000Z' },
      { id: '3', from_role: 'applicant', created_at: '2026-01-01T12:00:00.000Z' },
      { id: '4', from_role: 'admin', created_at: '2026-01-01T13:00:00.000Z' },
    ]
    assert.equal(countUnreadApplicantMessages(messages, null), 2)
    assert.equal(countUnreadApplicantMessages(messages, '2026-01-01T11:30:00.000Z'), 1)
    assert.equal(countUnreadApplicantMessages(messages, '2026-01-01T12:00:00.000Z'), 0)
  })

  it('formats compact red badge labels', () => {
    assert.equal(formatUnreadBadgeCount(0), '')
    assert.equal(formatUnreadBadgeCount(3), '3')
    assert.equal(formatUnreadBadgeCount(12), '9+')
  })

  it('clips toast previews', () => {
    assert.equal(clipMessagePreview('  Hello there  '), 'Hello there')
    assert.match(clipMessagePreview('x'.repeat(100), 20), /…$/)
  })
})

describe('message alert wiring', () => {
  it('shows a red unread counter on Messages and a dashboard toast host', () => {
    const page = readFileSync('src/app/admin/credit-funding/page.tsx', 'utf8')
    const sidebar = readFileSync('src/components/admin/AdminSidebar.tsx', 'utf8')
    const shell = readFileSync('src/components/admin/AdminShell.tsx', 'utf8')
    const alerts = readFileSync('src/components/admin/AdminLiveMessageAlerts.tsx', 'utf8')
    const route = readFileSync('src/app/api/admin/credit-funding/message-alerts/route.ts', 'utf8')
    const db = readFileSync('src/lib/credit-funding-db.ts', 'utf8')

    assert.match(page, /countUnreadApplicantMessages/)
    assert.match(page, /unreadMessageCount/)
    assert.match(page, /bg-red-500/)
    assert.match(page, /tabParam === 'messages'/)
    assert.match(sidebar, /staffUnreadCount/)
    assert.match(sidebar, /\/admin\/messages/)
    assert.match(sidebar, /bg-red-500/)
    assert.match(shell, /AdminLiveMessageAlerts/)
    assert.match(alerts, /Staff message from/)
    assert.match(alerts, /Message from/)
    assert.match(alerts, /message-alerts/)
    assert.match(alerts, /staff-direct-messages/)
    assert.match(alerts, /admin\/messages\?with=/)
    assert.match(route, /getRecentApplicantMessages/)
    assert.match(db, /getRecentApplicantMessages/)
  })
})
