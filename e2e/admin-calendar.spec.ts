import { expect, test, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const SECRET = process.env.NEXTAUTH_SECRET || 'e2e-prospect-file-secret'

test.use({
  video: 'on',
})

async function signInAndMockCalendar(page: Page) {
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
  await page.route('**/api/admin/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/api/admin/today')) {
      await route.fulfill({
        json: {
          kind: 'marketing',
          role: 'admin',
          followUps: [],
          handoffs: [],
          meetings: [],
          metrics: [],
          workspaceConnected: false,
        },
      })
      return
    }
    if (url.includes('/api/admin/calendar')) {
      const parsed = new URL(url)
      const from = parsed.searchParams.get('from') || '2026-11-01'
      await route.fulfill({
        json: {
          timezone: 'America/New_York',
          from,
          to: parsed.searchParams.get('to'),
          workspaceConnected: false,
          sources: { meetings: 'ok', todos: 'ok', google: 'disconnected' },
          events: [
            {
              id: 'meeting:1',
              kind: 'meeting',
              title: 'Lumen consult',
              start: `${from}T14:00:00.000Z`,
              allDay: false,
              dateKey: from,
              href: '/admin/pipeline/lead-1',
              prospectId: 'lead-1',
              meetLink: 'https://meet.google.com/lumen-live',
            },
            {
              id: 'todo:1',
              kind: 'todo',
              title: 'Send recap',
              start: from,
              allDay: true,
              dateKey: from,
              href: '/admin/todos?todo=todo-1',
              todoId: 'todo-1',
            },
          ],
        },
      })
      return
    }
    await route.fulfill({ json: { colleagues: [], alerts: [], notifications: [], todos: [] } })
  })
}

test.describe('admin calendar', () => {
  test('shows a native week and month grid on desktop', async ({ page }) => {
    await signInAndMockCalendar(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/admin/calendar')

    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
    await expect(page.getByText('America/New_York')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Week', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Month', exact: true })).toBeVisible()
    await expect(page.locator('iframe')).toHaveCount(0)
    await expect(page.getByTestId('calendar-week')).toBeVisible()
    await expect(page.getByTestId('calendar-week').getByText('Lumen consult')).toBeVisible()
    await expect(page.getByTestId('calendar-week').getByText('Send recap')).toBeVisible()
    await page.screenshot({ path: '/opt/cursor/artifacts/calendar-week-desktop.png', fullPage: true })

    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await expect(page.getByTestId('calendar-month')).toBeVisible()
    await expect(page.getByTestId('calendar-month').getByText('Lumen consult')).toBeVisible()
    await page.screenshot({ path: '/opt/cursor/artifacts/calendar-month-desktop.png', fullPage: true })
  })

  test('uses a readable agenda on a 390px phone', async ({ page }) => {
    await signInAndMockCalendar(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin/calendar')

    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Week', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Month', exact: true })).toBeVisible()
    await expect(page.getByTestId('calendar-agenda')).toBeVisible()
    await expect(page.getByTestId('calendar-week')).toBeHidden()
    await expect(page.getByTestId('calendar-agenda').getByText('Lumen consult')).toBeVisible()
    await expect(page.getByTestId('calendar-agenda').getByText('Send recap')).toBeVisible()
    await page.screenshot({ path: '/opt/cursor/artifacts/calendar-agenda-mobile.png', fullPage: true })

    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await expect(page.getByTestId('calendar-month-phone')).toBeVisible()
    await expect(page.getByTestId('calendar-agenda')).toBeVisible()
    await page.screenshot({ path: '/opt/cursor/artifacts/calendar-month-mobile.png', fullPage: true })
  })

  test('does not duplicate the calendar on Today', async ({ page }) => {
    await signInAndMockCalendar(page)

    for (const viewport of [
      { width: 1280, height: 900, shot: 'today-without-calendar-desktop.png' },
      { width: 390, height: 844, shot: 'today-without-calendar-mobile.png' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/admin')
      await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
      await expect(page.getByRole('heading', { name: "Today's Calendar" })).toHaveCount(0)
      await page.screenshot({ path: `/opt/cursor/artifacts/${viewport.shot}`, fullPage: true })
      if (viewport.width <= 390) {
        await page.getByRole('button', { name: 'Toggle menu' }).click()
      }
      await expect(page.getByRole('link', { name: 'Calendar' })).toBeVisible()
    }
  })
})
