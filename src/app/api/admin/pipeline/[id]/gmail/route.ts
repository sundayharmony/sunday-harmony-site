import { NextRequest, NextResponse } from 'next/server'
import { roleMayUsePipeline, sendProspectEmail } from '@/lib/marketing-crm'
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
    const subject = typeof body.subject === 'string' ? body.subject : ''
    const text = typeof body.body === 'string' ? body.body : ''
    if (!subject.trim() || !text.trim()) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }
    const prospect = await sendProspectEmail(id, { subject, body: text }, marketingActor(session))
    return NextResponse.json({ prospect })
  } catch (error) {
    return marketingError(error)
  }
}
