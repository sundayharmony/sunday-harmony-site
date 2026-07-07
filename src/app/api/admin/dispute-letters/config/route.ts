import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { fetchDisputeLettersConfig } from '@/lib/dispute-letters/api-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const config = await fetchDisputeLettersConfig()
  return NextResponse.json(config)
}
