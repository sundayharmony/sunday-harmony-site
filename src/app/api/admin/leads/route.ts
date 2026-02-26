import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeads, updateLead, logActivity } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const leads = await getLeads()
  return NextResponse.json(leads)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, ...allUpdates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })

  // Whitelist allowed fields
  const allowedFields = ['status', 'notes', 'phone', 'email', 'business', 'industry', 'service', 'budget']
  const updates = Object.fromEntries(
    Object.entries(allUpdates).filter(([key]) => allowedFields.includes(key))
  )

  const lead = await updateLead(id, updates)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const changedFields = Object.keys(updates).join(', ')
  logActivity({
    action: 'updated',
    entity_type: 'lead',
    entity_id: id,
    actor_email: (session?.user as { email?: string })?.email || 'admin',
    details: `Updated lead "${lead.first_name} ${lead.last_name}": ${changedFields}`,
  })

  return NextResponse.json(lead)
}
