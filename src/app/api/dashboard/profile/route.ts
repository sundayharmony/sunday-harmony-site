import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getClientById } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = session.user.clientId
  if (!clientId) {
    return NextResponse.json({ error: 'No client profile linked' }, { status: 404 })
  }

  const client = getClientById(clientId)
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Return client data (excluding internal fields)
  return NextResponse.json({
    id: client.id,
    name: client.name,
    business: client.business,
    email: client.email,
    phone: client.phone,
    industry: client.industry,
    packageTier: client.packageTier,
    monthlyPrice: client.monthlyPrice,
    startDate: client.startDate,
    status: client.status,
    deliverables: client.deliverables,
    quickWins: client.quickWins,
  })
}
