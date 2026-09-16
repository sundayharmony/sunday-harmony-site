import { NextResponse } from 'next/server'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { resetDisputeWorkForApplication } from '@/lib/dispute-letters/dispute-lifecycle-db'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

/** DELETE all reports, letters, rounds, and item history for this application. */
export async function POST(_request: Request, context: RouteContext) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await context.params
  const application = await getCreditFundingApplicationById(id)
  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const result = await resetDisputeWorkForApplication(id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  return NextResponse.json(result)
}
