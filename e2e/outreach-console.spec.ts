import { expect, test, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const SECRET = process.env.NEXTAUTH_SECRET || 'e2e-prospect-file-secret'

test.use({
  video: { mode: 'on', size: { width: 1280, height: 720 } },
})

const consolePayload = {
  disabled: true,
  liveSend: false,
  storage: 'ephemeral_unmigrated',
  senderConfigured: false,
  canOperate: true,
  attachmentPresent: true,
  scheduler: {
    path: '/api/internal/outreach-dispatch',
    schedule: '0 14 * * 1-5',
    enabled: false,
    note: 'Opt-in example only. Registering this cron would still hit DisabledProvider unless every activation gate is already satisfied.',
  },
  settings: {
    killSwitch: true,
    activatedAt: null,
    physicalMailingAddress: 'PO Box 1011, Jersey City, NJ 07304',
    senderEmail: 'sales@sundayharmony.com',
    signerName: 'Mac',
    companyName: 'Sunday Harmony Consulting',
    ctaUrl: 'https://www.sundayharmony.com/book',
    ctaLabel: 'Pick a time',
    dailySendLimit: 0,
    historyReconciliationStatus: 'unverified_reports_loaded',
    optOutVerifiedAt: null,
    settingsVersion: 1,
  },
  template: { approved: false, version: 1 },
  blockers: [
    { code: 'kill_switch', message: 'Global kill switch is on.' },
    { code: 'not_activated', message: 'Explicit activation has not been recorded.' },
    { code: 'template_unapproved', message: 'Template version is unapproved.' },
  ],
  queue: [
    {
      id: 'q-1',
      business: 'SwingStop Hammonton',
      email: 'info@swingstopvineland.com',
      status: 'pending',
      reason: 'eligible',
      deliveryState: 'not_sent',
      acceptedAt: null,
      contactedAt: null,
      subject: 'SwingStop Hammonton: a note from Sunday Harmony',
      previewText: 'Hi Christopher,\n\nI came across SwingStop Hammonton while looking at Indoor golf simulator in Hammonton, NJ.',
      previewHtml: '<p>Hi Christopher,</p>',
      attachment: 'Sunday-Harmony-Consulting-company-presentation.pdf',
      facts: { business: 'SwingStop Hammonton', firstName: 'Christopher' },
      handoff: {
        phone: '877-734-9145',
        booking: { status: 'none', startsAt: null },
        customMessage: 'Queued preview only.',
      },
    },
  ],
  reconciliation: [
    {
      business: 'Wise Bean',
      email: 'hey@wisebean.com',
      outcome: 'null_mx',
      providerConfirmed: false,
      notes: 'Reported Null MX. Unverified.',
    },
  ],
  audit: [{ id: 'a1', action: 'dispatch_invoked', createdAt: '2026-11-05T12:00:00.000Z' }],
  provider: {
    intended: 'gmail',
    idempotencyRecovery: false,
    note: 'Gmail is bound only when every activation gate is satisfied.',
  },
}

async function signInAndMockOutreach(page: Page) {
  const token = await encode({
    token: {
      sub: 'admin-1',
      email: 'sales@sundayharmony.com',
      name: 'Admin',
      role: 'admin',
      mfaVerified: true,
      mfaPending: false,
      mfaEnrollmentRequired: false,
      staffSessionStartedAt: Math.floor(Date.now() / 1000),
      lastDbCheckAt: Date.now(),
    },
    secret: SECRET,
  })
  await page.context().addCookies([
    {
      name: 'next-auth.session-token',
      value: token,
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.route('**/api/admin/**', async (route) => {
    if (route.request().url().includes('/api/admin/outreach')) {
      if (route.request().method() === 'POST') {
        await route.fulfill({ json: { ok: false, activated: false, error: 'Blocked by server gates' } })
        return
      }
      await route.fulfill({ json: consolePayload })
      return
    }
    await route.fulfill({ json: { colleagues: [], alerts: [], notifications: [] } })
  })
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        user: {
          name: 'Admin',
          email: 'sales@sundayharmony.com',
          role: 'admin',
          mfaVerified: true,
        },
      },
    })
  })
}

test.describe('outreach admin preview', () => {
  test('shows disabled queue preview for an authenticated admin', async ({ page }) => {
    await signInAndMockOutreach(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/admin')
    await page.getByRole('link', { name: /Outreach/i }).click()
    await expect(page).toHaveURL(/\/admin\/outreach/)
    await expect(page.getByRole('heading', { name: 'Prospect outreach' })).toBeVisible()
    await expect(page.getByText('Disabled automation')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Physical mailing address' })).toHaveValue(
      'PO Box 1011, Jersey City, NJ 07304'
    )
    await expect(page.getByRole('button', { name: 'SwingStop Hammonton' })).toBeVisible()
    await expect(page.getByText('Hi Christopher,')).toBeVisible()
    await expect(page.getByText('kill_switch')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Record activation (server gates only)' })).toBeVisible()
    await page.screenshot({
      path: '/opt/cursor/artifacts/outreach-console-desktop.png',
      fullPage: true,
    })
  })

  test('keeps the same preview usable at 390px', async ({ page }) => {
    await signInAndMockOutreach(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin')
    await page.getByRole('button', { name: 'Toggle menu' }).click()
    await page.getByRole('link', { name: /Outreach/i }).click()
    await expect(page).toHaveURL(/\/admin\/outreach/)
    await expect(page.getByRole('heading', { name: 'Prospect outreach' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Physical mailing address' })).toHaveValue(
      'PO Box 1011, Jersey City, NJ 07304'
    )
    await expect(page.getByRole('button', { name: 'SwingStop Hammonton' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Prepare queue (no send)' })).toBeVisible()
    await page.getByRole('button', { name: 'Toggle menu' }).click()
    await expect(page.getByRole('link', { name: /Outreach/i }).first()).toBeVisible()
    await page.screenshot({
      path: '/opt/cursor/artifacts/outreach-console-390.png',
      fullPage: true,
    })
  })
})
