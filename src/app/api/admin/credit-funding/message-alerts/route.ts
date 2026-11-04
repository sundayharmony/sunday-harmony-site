import { NextRequest, NextResponse } from 'next/server'
import {
  filterCreditApplicationsForViewer,
  viewerFromSession,
} from '@/lib/credit-expert-assignment'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  getCreditFundingApplications,
  getRecentApplicantMessages,
} from '@/lib/credit-funding-db'

export const dynamic = 'force-dynamic'

/**
 * Lightweight poll feed of recent applicant messages for staff toasts / badges.
 * Scoped to applications the viewer may access.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireCreditFundingStaffSession()
    if (session instanceof NextResponse) return session

    const since = req.nextUrl.searchParams.get('since') || undefined
    const applications = filterCreditApplicationsForViewer(
      await getCreditFundingApplications({ status: 'all', search: '' }),
      viewerFromSession(session)
    )
    const byId = new Map(applications.map((app) => [app.id, app]))
    const messages = await getRecentApplicantMessages({
      applicationUuids: applications.map((app) => app.id),
      sinceIso: since || undefined,
      limit: 25,
    })

    const alerts = messages.map((message) => {
      const app = byId.get(message.application_uuid)
      return {
        id: message.id,
        applicationUuid: message.application_uuid,
        applicationId: app?.application_id || '',
        fullName: app?.full_name || 'Client',
        fromName: message.from_name || app?.full_name || 'Client',
        text: message.text,
        createdAt: message.created_at,
      }
    })

    return NextResponse.json({ alerts })
  } catch (err) {
    console.error('credit-funding message-alerts', err)
    return NextResponse.json({ error: 'Failed to load message alerts' }, { status: 500 })
  }
}
