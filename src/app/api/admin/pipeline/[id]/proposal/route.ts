import { NextRequest, NextResponse } from 'next/server'
import { createProspectProposal, roleMayEditPipeline } from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayEditPipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const prospect = await createProspectProposal(id, body, marketingActor(session))
    return NextResponse.json({ prospect })
  } catch (error) {
    return marketingError(error)
  }
}
