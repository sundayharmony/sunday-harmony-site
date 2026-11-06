import { expect, test, type Page } from '@playwright/test'
import { encode } from 'next-auth/jwt'

const SECRET = process.env.NEXTAUTH_SECRET || 'e2e-prospect-file-secret'
const PROSPECT_ID = 'lead-sales-cards-1'

test.use({
  video: 'on',
})

const baseProspect = {
  id: PROSPECT_ID,
  business: 'Lumen & Co. Floral',
  contactName: 'Maya Ellison',
  email: 'maya@lumenandco.example',
  phone: '804-555-0148',
  industry: 'Retail florist',
  website: 'https://lumenandco.example',
  location: 'Richmond, VA',
  category: 'small',
  opportunity: 'Quiet Instagram and no online ordering.',
  recommendedService: 'Social Essentials',
  scoreFactors: { weakness: 2, operating: 2, need: 2, decision_maker: 1, ability: 1 },
  source: 'in_person',
  lastContactedAt: null,
  followUpAt: null,
  stage: 'contacted',
  estimatedValue: 250,
  notes: '',
  gmailThreadId: null,
  driveFolderUrl: null,
  proposalDocUrl: null,
  agreementSignedAt: null,
  handedToSalesAt: '2026-11-02T15:00:00.000Z',
  paymentStatus: '',
  servicesPurchased: '',
  scope: '',
  deliverables: '',
  deadline: '',
  promises: '',
  expectations: '',
  creditApplicationId: null,
  closeMethod: null,
}

const upcomingMeeting = {
  id: 'meet-1',
  prospectId: PROSPECT_ID,
  business: 'Lumen & Co. Floral',
  title: 'Meeting: Lumen & Co. Floral',
  startsAt: '2026-11-06T16:00:00.000Z',
  meetLink: 'https://meet.google.com/lumen-live',
  calendarLink: 'https://calendar.google.com/event?eid=evt-lumen',
}

async function signIn(page: Page) {
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
}

async function mockProspect(
  page: Page,
  payload: {
    prospect?: Record<string, unknown>
    meetings?: unknown[]
    meetingCardState?: string
    agreementStatus?: string
    agreement?: Record<string, unknown>
  }
) {
  await page.route('**/api/admin/**', async (route) => {
    const url = route.request().url()
    if (url.includes(`/api/admin/pipeline/${PROSPECT_ID}`) && route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          prospect: { ...baseProspect, ...payload.prospect },
          scripts: [],
          meetings: payload.meetings || [],
          meetingHistory: payload.meetings || [],
          meetingCardState: payload.meetingCardState || 'none',
          agreementStatus: payload.agreementStatus || 'none',
          agreement: payload.agreement || { status: payload.agreementStatus || 'none' },
          workspaceConnected: true,
          stripePaid: false,
        },
      })
      return
    }
    await route.fulfill({ json: { colleagues: [], alerts: [], notifications: [] } })
  })
}

async function box(page: Page, testId: string) {
  const locator = page.getByTestId(testId)
  await locator.scrollIntoViewIfNeeded()
  return locator.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return { width: rect.width, y: rect.y }
  })
}

async function expectStackedCards(page: Page) {
  const scheduleBox = await box(page, 'schedule-meeting-card')
  const sendBox = await box(page, 'send-agreement-card')
  expect(scheduleBox.width).toBeGreaterThan(280)
  expect(sendBox.width).toBeGreaterThan(280)
  expect(sendBox.y).toBeGreaterThan(scheduleBox.y + 40)
}

test.describe('closer sales cards', () => {
  test('shows unsigned and unscheduled forms on desktop and phone', async ({ page }) => {
    await signIn(page)
    await mockProspect(page, { meetingCardState: 'none', agreementStatus: 'none' })

    for (const viewport of [
      { width: 1280, height: 900, shot: 'prospect-cards-unsigned-unscheduled-desktop.png', stacked: false },
      { width: 390, height: 844, shot: 'prospect-cards-unsigned-unscheduled-mobile.png', stacked: true },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/admin/pipeline/${PROSPECT_ID}`)
      await expect(page.getByRole('heading', { name: 'Schedule meeting' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Send agreement' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Schedule meeting' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Send agreement' })).toBeVisible()
      if (viewport.stacked) await expectStackedCards(page)
      await page.screenshot({ path: `/opt/cursor/artifacts/${viewport.shot}`, fullPage: true })
    }
  })

  test('shows an upcoming booked card and hides the empty schedule form', async ({ page }) => {
    await signIn(page)
    await mockProspect(page, {
      prospect: { stage: 'meeting_scheduled', followUpAt: upcomingMeeting.startsAt },
      meetings: [upcomingMeeting],
      meetingCardState: 'upcoming',
      agreementStatus: 'none',
    })

    for (const viewport of [
      { width: 1280, height: 900, shot: 'prospect-cards-upcoming-desktop.png' },
      { width: 390, height: 844, shot: 'prospect-cards-upcoming-mobile.png' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/admin/pipeline/${PROSPECT_ID}`)
      await expect(page.getByRole('heading', { name: 'Scheduled meeting' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Join meeting' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Reschedule' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Schedule meeting' })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Send agreement' })).toBeVisible()
      await page.getByRole('button', { name: 'Reschedule' }).click()
      await expect(page.getByRole('button', { name: 'Save new time' })).toBeVisible()
      await page.screenshot({ path: `/opt/cursor/artifacts/${viewport.shot}`, fullPage: true })
    }
  })

  test('hides send agreement after it is signed', async ({ page }) => {
    await signIn(page)
    await mockProspect(page, {
      meetingCardState: 'none',
      agreementStatus: 'signed',
      agreement: {
        status: 'signed',
        documentNumber: 'SA-2611-0042',
        signedAt: '2026-11-02T16:00:00.000Z',
      },
    })

    for (const viewport of [
      { width: 1280, height: 900, shot: 'prospect-cards-signed-desktop.png' },
      { width: 390, height: 844, shot: 'prospect-cards-signed-mobile.png' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/admin/pipeline/${PROSPECT_ID}`)
      await expect(page.getByRole('heading', { name: 'Agreement signed' })).toBeVisible()
      await expect(page.getByText('SA-2611-0042')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Send agreement' })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Schedule meeting' })).toBeVisible()
      await page.screenshot({ path: `/opt/cursor/artifacts/${viewport.shot}`, fullPage: true })
    }
  })

  test('hides the schedule form after a past meeting', async ({ page }) => {
    await signIn(page)
    await mockProspect(page, {
      prospect: { stage: 'proposal_sent', followUpAt: '2026-11-01T16:00:00.000Z' },
      meetings: [],
      meetingCardState: 'past',
      agreementStatus: 'none',
    })

    for (const viewport of [
      { width: 1280, height: 900, shot: 'prospect-cards-past-desktop.png' },
      { width: 390, height: 844, shot: 'prospect-cards-past-mobile.png' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/admin/pipeline/${PROSPECT_ID}`)
      await expect(page.getByRole('heading', { name: 'Schedule meeting' })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Scheduled meeting' })).toHaveCount(0)
      await expect(page.getByText('had a meeting')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Send agreement' })).toBeVisible()
      await page.screenshot({ path: `/opt/cursor/artifacts/${viewport.shot}`, fullPage: true })
    }
  })
})
