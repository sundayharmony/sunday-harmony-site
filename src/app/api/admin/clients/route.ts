import { NextRequest, NextResponse } from 'next/server'
import { getClients, createClient, updateClient, createUser } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getClients())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, business, email, phone, industry, packageTier, monthlyPrice, loginPassword } = body

  if (!name || !business || !email || !packageTier) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Create client record
  const client = createClient({
    name,
    business,
    email,
    phone,
    industry,
    packageTier,
    monthlyPrice: monthlyPrice || 0,
    startDate: new Date().toISOString(),
    status: 'active',
    notes: '',
    deliverables: [],
    quickWins: [],
  })

  // Create login account if password provided
  if (loginPassword) {
    createUser({
      email,
      password: loginPassword,
      name,
      role: 'client',
      clientId: client.id,
    })
  }

  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  const client = updateClient(id, updates)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  return NextResponse.json(client)
}
