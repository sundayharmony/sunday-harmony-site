import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Customer Portal retired — manage cards and plans in-app. */
export async function POST() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  return NextResponse.json(
    {
      error:
        'Stripe Customer Portal is disabled. Manage payment methods and subscriptions in the billing panel.',
    },
    { status: 410 }
  )
}
