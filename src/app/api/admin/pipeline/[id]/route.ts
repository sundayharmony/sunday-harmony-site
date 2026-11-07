import { NextRequest, NextResponse } from 'next/server'
import { isGoogleWorkspaceConfigured } from '@/lib/google-workspace'
import {
  getMarketingProspect,
  prospectFileSalesPayload,
  prospectVisibleToRole,
  roleMayEditPipeline,
  roleMayUsePipeline,
  saveMarketingProspect,
  scriptsForProspect,
  stripePaidForProspect,
} from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { buildOutreachLetterForLead } from '@/lib/outreach/console'
import { resolveOutreachStore } from '@/lib/outreach/runtime'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

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
  const sales = await prospectFileSalesPayload(prospect)
  let outreachLetter = null
  try {
    outreachLetter = await buildOutreachLetterForLead(resolveOutreachStore(), id)
  } catch {
    outreachLetter = null
  }
  return NextResponse.json({
    prospect,
    scripts: scriptsForProspect(prospect, marketingActor(session)),
    meetings: sales.meetings,
    meetingHistory: sales.meetingHistory,
    meetingCardState: sales.meetingCardState,
    agreementStatus: sales.agreement.status,
    agreement: sales.agreement,
    workspaceConnected: isGoogleWorkspaceConfigured(),
    stripePaid: await stripePaidForProspect(prospect),
    outreachLetter,
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayEditPipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const result = await saveMarketingProspect(id, body, marketingActor(session))
    return NextResponse.json(result)
  } catch (error) {
    return marketingError(error)
  }
}
