import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as { role?: string; clientId?: string }
  if (user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = user.clientId
  if (!clientId) {
    return NextResponse.json({ error: 'No client profile linked' }, { status: 404 })
  }

  const client = await getClientById(clientId)
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
    package_tier: client.package_tier || 'spark',
    monthly_price: client.monthly_price || 0,
    start_date: client.start_date || new Date().toISOString(),
    status: client.status || 'active',
    billing_status: client.billing_status || 'not_started',
    next_billing_date: client.next_billing_date || null,
    last_payment_at: client.last_payment_at || null,
    stripe_customer_id: client.stripe_customer_id || '',
    deliverables: Array.isArray(client.deliverables) ? client.deliverables : [],
    quick_wins: Array.isArray(client.quick_wins) ? client.quick_wins : [],
  })
}
