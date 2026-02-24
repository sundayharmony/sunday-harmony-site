import { NextRequest, NextResponse } from 'next/server'
import { getLeads, updateLead } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getLeads())
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })
  const lead = updateLead(id, updates)
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  return NextResponse.json(lead)
}
