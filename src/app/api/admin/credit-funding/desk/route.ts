import { NextResponse } from 'next/server'
import { viewerFromSession } from '@/lib/credit-expert-assignment'
import { loadCreditDesk } from '@/lib/credit-desk-server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

/** The Credit desk: queue, phases, rounds, and insights. Credit experts see only their clients. */
export async function GET() {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session
  try {
    return NextResponse.json(await loadCreditDesk(viewerFromSession(session)))
  } catch (error) {
    console.error('credit desk error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Could not load the credit desk' }, { status: 500 })
  }
}
