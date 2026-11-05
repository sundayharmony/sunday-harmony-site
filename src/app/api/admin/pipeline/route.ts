import { NextRequest, NextResponse } from 'next/server'
import {
  isGoogleWorkspaceConfigured,
} from '@/lib/google-workspace'
import { attachProspectMeetingLinks, listMarketingProspects, roleMayEditPipeline, roleMayUsePipeline, saveMarketingProspect } from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { boardLanes, FIELD_PURPOSES, SCORE_FACTORS, STAGE_LABELS, staffStagesVisibleToRole } from '@/lib/marketing-pipeline'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayUsePipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const prospects = await attachProspectMeetingLinks(
    await listMarketingProspects(session.user.role),
    session.user.role
  )
  return NextResponse.json({
    role: session.user.role,
    lanes: boardLanes(session.user.role),
    prospects,
    stages: staffStagesVisibleToRole(session.user.role),
    stageLabels: STAGE_LABELS,
    scoreFactors: SCORE_FACTORS,
    purposes: FIELD_PURPOSES,
    workspaceConnected: isGoogleWorkspaceConfigured(),
  })
}

export async function POST(req: NextRequest) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayEditPipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const result = await saveMarketingProspect(null, body, marketingActor(session))
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return marketingError(error)
  }
}
