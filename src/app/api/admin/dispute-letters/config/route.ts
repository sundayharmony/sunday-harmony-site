import { NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { fetchDisputeLettersConfig } from '@/lib/dispute-letters/api-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const config = await fetchDisputeLettersConfig()
  return NextResponse.json(config)
}
