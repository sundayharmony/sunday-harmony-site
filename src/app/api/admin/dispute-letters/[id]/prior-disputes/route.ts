import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { loadPriorDisputeMarksForSession } from '@/lib/dispute-letters/dispute-lifecycle-db'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** GET — accounts already disputed in earlier rounds for this session's case. */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const result = await loadPriorDisputeMarksForSession(id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('prior-disputes load error:', err)
    return NextResponse.json({
      marks: [],
      marksByTradelineId: {},
      itemCount: 0,
    })
  }
}
