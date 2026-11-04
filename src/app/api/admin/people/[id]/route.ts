import { NextResponse } from 'next/server'
import { viewerFromSession } from '@/lib/credit-expert-assignment'
import { requireStaffSession } from '@/lib/stripe-admin-auth'
import { getPersonFile } from '@/lib/people-db'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const role = session.user.role === 'credit_manager' ? 'credit_manager' : 'admin'
  const file = await getPersonFile(id, role, new Date(), viewerFromSession(session))
  if (!file) return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  return NextResponse.json(file)
}
