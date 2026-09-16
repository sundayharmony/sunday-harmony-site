import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getAdminPayouts, getAdminReferralOverview } from '@/lib/referral-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const [overview, payouts] = await Promise.all([getAdminReferralOverview(), getAdminPayouts()])
  return NextResponse.json({ ...overview, payouts })
}
