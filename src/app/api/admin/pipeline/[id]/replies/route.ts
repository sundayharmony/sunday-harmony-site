import { NextResponse } from 'next/server'
import { checkProspectReplies, roleMayEditPipeline } from '@/lib/marketing-crm'
import { marketingError } from '@/lib/marketing-http'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayEditPipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await params
    return NextResponse.json(await checkProspectReplies(id))
  } catch (error) {
    return marketingError(error)
  }
}
