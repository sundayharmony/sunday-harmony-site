import { NextResponse } from 'next/server'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { resetDisputeLettersAndRoundsForApplication } from '@/lib/dispute-letters/dispute-lifecycle-db'
import { creditApplicationAccessDenied, viewerFromSession } from '@/lib/credit-expert-assignment'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

/** Clear letters, plans, and rounds — keep uploaded reports and analysis. */
export async function POST(_request: Request, context: RouteContext) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const application = await getCreditFundingApplicationById(id)
  const denied = creditApplicationAccessDenied(viewerFromSession(session), application)
  if (denied) return denied
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const result = await resetDisputeLettersAndRoundsForApplication(id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json(result)
}
