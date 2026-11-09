import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { proxyDisputeLettersStream } from '@/lib/dispute-letters/api-client'
import { findMissingLetterIdentityForApplication } from '@/lib/dispute-letters/letter-identity-attachments'
import {
  canBypassLetterIdentityRequirements,
  letterIdentityBypassAllowed,
} from '@/lib/dispute-letters/letter-identity-bypass'
import {
  loadLetterConsumerIdentity,
  resolveLetterConsumerFields,
} from '@/lib/dispute-letters/letter-consumer-identity'
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
    const missing = await findMissingLetterIdentityForApplication(access.session.application_uuid)
    if (missing.length && !letterIdentityBypassAllowed(body, session.user.role)) {
      return NextResponse.json(
        {
          error: `Add ${missing.map((item) => item.label).join(', ')} before generating letters.`,
          code: 'missing_letter_identity',
          missing: missing.map((item) => ({ key: item.key, label: item.label })),
          applicationId: access.session.application_uuid,
          canBypass: canBypassLetterIdentityRequirements(session.user.role),
        },
        { status: 409 }
      )
    }
    const identity = await loadLetterConsumerIdentity(id)
    const consumer = resolveLetterConsumerFields(body, identity)
    return proxyDisputeLettersStream('/internal/letters/generate/stream', {
      session_id: id,
      plan_ids: body.plan_ids ?? null,
      consumer_name: consumer.consumer_name,
      consumer_addresses: consumer.consumer_addresses,
      consumer_ssn: consumer.consumer_ssn,
      consumer_dob: consumer.consumer_dob,
    })
  } catch (err) {
    console.error('POST generate/stream error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
