import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLeads, updateLead, logActivity } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const leads = await getLeads()
  return NextResponse.json(leads)
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })
  const lead = await updateLead(id, updates)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const session = await getServerSession(authOptions)
  const changedFields = Object.keys(updates).join(', ')
  logActivity({
    action: 'updated',
    entity_type: 'lead',
    entity_id: id,
    actor_email: session?.user?.email || 'admin',
    details: `Updated lead "${lead.first_name} ${lead.last_name}": ${changedFields}`,
  })

  return NextResponse.json(lead)
}
