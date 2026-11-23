import { NextResponse } from 'next/server'
import { roleMayUsePipeline, sweepProspectReplies } from '@/lib/marketing-crm'
import { loadMarketingWorkspace } from '@/lib/marketing-workspace-server'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayUsePipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    return NextResponse.json(await loadMarketingWorkspace(session.user.role))
  } catch (error) {
    console.error('marketing desk error:', error)
    return NextResponse.json({ error: 'Could not load the marketing desk' }, { status: 500 })
  }
}

/** Check replies now: same sweep the daily cron runs. */
export async function POST() {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayUsePipeline(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    return NextResponse.json(await sweepProspectReplies())
  } catch (error) {
    console.error('marketing reply sweep error:', error)
    return NextResponse.json({ error: 'Could not check replies' }, { status: 500 })
  }
}
