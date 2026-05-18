import { NextRequest, NextResponse } from 'next/server'
import { authorizeBillingClient } from '@/lib/billing-access'
import { cancelSubscription, logBillingActivity, type CancelAction } from '@/lib/billing-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS: CancelAction[] = ['cancel_at_period_end', 'resume', 'cancel_immediately']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await authorizeBillingClient(typeof body.clientId === 'string' ? body.clientId : undefined)
  if (auth instanceof NextResponse) return auth

  const action = body.action as CancelAction
  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: 'action must be cancel_at_period_end, resume, or cancel_immediately' },
      { status: 400 }
    )
  }

  const result = await cancelSubscription(auth.clientId, action)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  await logBillingActivity(auth.clientId, auth.actorEmail, `Subscription action: ${action}`)
  return NextResponse.json({
    ok: true,
    subscription: result.subscription
      ? {
          id: result.subscription.id,
          status: result.subscription.status,
          cancel_at_period_end: result.subscription.cancel_at_period_end,
        }
      : null,
  })
}
