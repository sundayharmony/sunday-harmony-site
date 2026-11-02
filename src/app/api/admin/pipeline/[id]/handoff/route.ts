import { NextRequest, NextResponse } from 'next/server'
import { handOffProspect, roleMayUsePipeline } from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayUsePipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const target = body.target === 'client_relations' ? 'client_relations' : 'sales_closer'
    const prospect = await handOffProspect(id, target, marketingActor(session))
    return NextResponse.json({ prospect })
  } catch (error) {
    return marketingError(error)
  }
}
