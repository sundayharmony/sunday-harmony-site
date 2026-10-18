import { NextRequest, NextResponse } from 'next/server'
import { requireStaffSession } from '@/lib/stripe-admin-auth'
import { listPeople, type PersonScope } from '@/lib/people-db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session

  const requested = new URL(request.url).searchParams.get('scope')
  const scope: PersonScope = session.user.role === 'credit_manager' || requested === 'credit' ? 'credit' : 'all'
  const people = await listPeople(scope)
  return NextResponse.json({ people, scope })
}
