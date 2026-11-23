import { NextRequest, NextResponse } from 'next/server'
import { getMarketingProspect, prospectVisibleToRole, roleMayUsePipeline } from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { loadProspectTimeline, logProspectActivity } from '@/lib/marketing-workspace-server'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** The lead's timeline: logged calls and notes plus milestones stamped on the lead. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayUsePipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const prospect = await getMarketingProspect(id)
  if (!prospect || !prospectVisibleToRole(prospect, session.user.role)) {
    return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
  }
  return NextResponse.json({ timeline: await loadProspectTimeline(prospect) })
}

/** Log a call outcome or a note. Body: { type: 'call' | 'note', outcome?, note?, followUpAt? } */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(await logProspectActivity(id, body, marketingActor(session)))
  } catch (error) {
    return marketingError(error)
  }
}
