import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Redirect checkout retired — use embedded billing on admin/clients or /dashboard/billing. */
export async function POST() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  return NextResponse.json(
    {
      error:
        'Hosted Stripe Checkout is disabled. Use in-app billing (Payment Element) from the client billing panel or /dashboard/billing.',
    },
    { status: 410 }
  )
}
