import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { COMMISSION_STATUSES, type CommissionStatus } from '@/lib/referrals'
import {
  adminAdjustCommission,
  adminRegenerateReferralCode,
  adminSetReferralEnabled,
  getAdminReferralClient,
  initiateReferralPayout,
} from '@/lib/referral-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { clientId } = await params
  const result = await getAdminReferralClient(clientId)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { clientId } = await params
  const actorEmail = session.user.email || 'admin'
  const body = await req.json().catch(() => ({}))
  const action = typeof body.action === 'string' ? body.action : ''

  try {
    if (action === 'enable' || action === 'disable') {
      const result = await adminSetReferralEnabled(clientId, action === 'enable', actorEmail)
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json(result)
    }
    if (action === 'regenerate') {
      const result = await adminRegenerateReferralCode(clientId, actorEmail)
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json(result)
    }
    if (action === 'payout') {
      const result = await initiateReferralPayout({
        clientId,
        actorEmail,
        provider: body.provider === 'manual' ? 'manual' : 'stripe',
        amountCents: typeof body.amountCents === 'number' ? body.amountCents : undefined,
        manualReference: typeof body.manualReference === 'string' ? body.manualReference : undefined,
      })
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json(result)
    }
    if (action === 'adjust') {
      const status = body.status as CommissionStatus
      if (!COMMISSION_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid commission status.' }, { status: 400 })
      }
      const result = await adminAdjustCommission({
        commissionId: typeof body.commissionId === 'string' ? body.commissionId : '',
        status,
        reason: typeof body.reason === 'string' ? body.reason : '',
        actorEmail,
        clientId,
      })
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    logApiRouteError(req, 'admin/referrals/[clientId]', error)
    return NextResponse.json({ error: 'Referral update failed.' }, { status: 500 })
  }
}
