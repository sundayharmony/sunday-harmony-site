import { NextRequest, NextResponse } from 'next/server'
import { getClients, createClient, updateClient, createUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clients = await getClients()
  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, business, email, phone, industry, packageTier, monthlyPrice, loginPassword, deliverables, quickWins } = body

  if (!name || !business || !email || !packageTier) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const client = await createClient({
    name,
    business,
    email,
    phone,
    industry,
    package_tier: packageTier,
    monthly_price: monthlyPrice || 0,
    start_date: new Date().toISOString(),
    status: 'active',
    notes: '',
    deliverables: deliverables || [],
    quick_wins: quickWins || [],
  })

  if (!client) return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })

  if (loginPassword) {
    await createUser({
      email,
      password: loginPassword,
      name,
      role: 'client',
      client_id: client.id,
    })
  }

  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  const client = await updateClient(id, updates)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  return NextResponse.json(client)
}
