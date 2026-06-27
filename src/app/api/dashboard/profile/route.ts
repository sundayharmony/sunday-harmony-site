import { NextResponse } from 'next/server'
import { getClientById } from '@/lib/db'
import { requireClientSession, getClientIdFromSession } from '@/lib/client-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireClientSession()
  if (session instanceof NextResponse) return session

  const client = await getClientById(getClientIdFromSession(session))
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: client.id,
    name: client.name || '',
    business: client.business || '',
    email: client.email || '',
    phone: client.phone || '',
    industry: client.industry || '',
    package_tier: client.package_tier || '',
    billing_status: client.billing_status || '',
    monthly_price: client.monthly_price ?? 0,
    status: client.status || '',
    is_potential: client.is_potential ?? false,
    stripe_subscription_id: client.stripe_subscription_id || null,
    created_at: client.created_at,
  })
}
