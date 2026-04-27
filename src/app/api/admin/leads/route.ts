import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createLead, getLeadByGooglePlaceId, getLeads, logActivity, updateLead } from '@/lib/db'

export const dynamic = 'force-dynamic'

function normalizeLoose(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizePhone(value?: string): string {
  return (value || '').replace(/\D+/g, '')
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const source = req.nextUrl.searchParams.get('source')
  const q = req.nextUrl.searchParams.get('q')
  const leads = await getLeads()

  let filtered = leads
  if (source === 'inbound' || source === 'outbound') {
    filtered = filtered.filter(lead => lead.source === source)
  }
  if (q && q.trim()) {
    const needle = normalizeLoose(q)
    filtered = filtered.filter(lead =>
      normalizeLoose(`${lead.first_name || ''} ${lead.last_name || ''}`).includes(needle) ||
      normalizeLoose(lead.business).includes(needle) ||
      normalizeLoose(lead.email).includes(needle)
    )
  }

  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    first_name,
    last_name,
    email,
    phone,
    business,
    industry,
    service,
    budget,
    message,
    source,
    website,
    google_place_id,
    location_text,
    discovered_at,
    last_contacted_at,
    status,
    notes,
  } = body

  if (!business || !String(business).trim()) {
    return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
  }

  if (google_place_id) {
    const existingByPlaceId = await getLeadByGooglePlaceId(String(google_place_id))
    if (existingByPlaceId) {
      return NextResponse.json({ duplicate: true, lead: existingByPlaceId }, { status: 200 })
    }
  }

  // Secondary duplicate check for near-matches when place id is missing
  const existingLeads = await getLeads()
  const businessNorm = normalizeLoose(String(business))
  const phoneNorm = normalizePhone(phone)
  const websiteNorm = normalizeLoose(website)
  const duplicate = existingLeads.find(lead => {
    const sameBusiness = normalizeLoose(lead.business) === businessNorm
    if (!sameBusiness) return false
    const samePhone = phoneNorm && normalizePhone(lead.phone) === phoneNorm
    const sameWebsite = websiteNorm && normalizeLoose(lead.website) === websiteNorm
    return Boolean(samePhone || sameWebsite)
  })
  if (duplicate) {
    return NextResponse.json({ duplicate: true, lead: duplicate }, { status: 200 })
  }

  const lead = await createLead({
    first_name: (first_name || 'Prospect').trim(),
    last_name: (last_name || '').trim(),
    email: (email || '').trim() || undefined,
    phone: (phone || '').trim() || undefined,
    business: String(business).trim(),
    industry: (industry || '').trim() || undefined,
    service: (service || '').trim() || undefined,
    budget: (budget || '').trim() || undefined,
    message: (message || '').trim() || undefined,
    source: source === 'outbound' ? 'outbound' : 'inbound',
    website: (website || '').trim() || undefined,
    google_place_id: (google_place_id || '').trim() || undefined,
    location_text: (location_text || '').trim() || undefined,
    discovered_at: discovered_at || undefined,
    last_contacted_at: last_contacted_at || undefined,
  })
  if (!lead) return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (notes) updates.notes = notes
  const finalLead = Object.keys(updates).length ? await updateLead(lead.id, updates) : lead

  logActivity({
    action: 'created',
    entity_type: 'lead',
    entity_id: lead.id,
    actor_email: (session?.user as { email?: string })?.email || 'admin',
    details: `Created ${lead.source} lead "${lead.first_name} ${lead.last_name}" (${lead.business})`,
  })

  return NextResponse.json(finalLead || lead)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, ...allUpdates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })

  // Whitelist allowed fields
  const allowedFields = [
    'status', 'notes', 'phone', 'email', 'business', 'industry', 'service', 'budget',
    'first_name', 'last_name', 'source', 'website', 'location_text', 'last_contacted_at',
  ]
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
