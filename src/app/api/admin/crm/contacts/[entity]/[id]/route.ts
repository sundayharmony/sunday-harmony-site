import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { getContactProfile } from '@/lib/crm-db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entity: string; id: string }> }
) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const params = await context.params
  const entity = params.entity === 'client' ? 'client' : 'lead'
  const data = await getContactProfile(entity, params.id)
  if (!data) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
