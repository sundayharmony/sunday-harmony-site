import { NextRequest, NextResponse } from 'next/server'
import { roleMayEditPipeline, scheduleProspectMeeting } from '@/lib/marketing-crm'
import { marketingActor, marketingError } from '@/lib/marketing-http'
import { roleMayRunSalesActions } from '@/lib/marketing-pipeline'
import { requireMarketingSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireMarketingSession()
  if (session instanceof NextResponse) return session
  if (!roleMayEditPipeline(session.user.role) || !roleMayRunSalesActions(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const startsAt = typeof body.startsAt === 'string' ? body.startsAt : ''
    const durationMinutes = typeof body.durationMinutes === 'number' ? body.durationMinutes : Number(body.durationMinutes)
    const notes = typeof body.notes === 'string' ? body.notes : ''
    if (!startsAt.trim()) {
      return NextResponse.json({ error: 'Choose a meeting time' }, { status: 400 })
    }
    const result = await scheduleProspectMeeting(
      id,
      {
        startsAt,
        durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 30,
        notes,
      },
      marketingActor(session)
    )
    return NextResponse.json(result)
  } catch (error) {
    return marketingError(error)
  }
}
