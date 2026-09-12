import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { currentLetters } from '@/lib/dispute-letters/current-letters'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import type { GeneratedLetter } from '@/lib/dispute-letters/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const data = await disputeLettersJson<{ session_id?: string; letters?: GeneratedLetter[] }>(
      `/internal/letters/${id}`
    )
    return NextResponse.json({
      ...data,
      letters: currentLetters(data.letters || []),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load letters'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
