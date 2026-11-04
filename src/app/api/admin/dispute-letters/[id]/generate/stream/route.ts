import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { proxyDisputeLettersStream } from '@/lib/dispute-letters/api-client'
import { loadLetterConsumerIdentity } from '@/lib/dispute-letters/letter-consumer-identity'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = await request.json().catch(() => ({}))
    const identity = await loadLetterConsumerIdentity(id)
    return proxyDisputeLettersStream('/internal/letters/generate/stream', {
      session_id: id,
      plan_ids: body.plan_ids ?? null,
      consumer_name: body.consumer_name ?? null,
      consumer_addresses: body.consumer_addresses ?? null,
      consumer_ssn: identity.ssn,
      consumer_dob: identity.dob,
    })
  } catch (err) {
    console.error('POST generate/stream error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
