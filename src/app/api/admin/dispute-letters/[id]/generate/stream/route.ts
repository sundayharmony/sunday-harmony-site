import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { proxyDisputeLettersStream } from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = await request.json().catch(() => ({}))
    return proxyDisputeLettersStream('/internal/letters/generate/stream', {
      session_id: id,
      plan_ids: body.plan_ids ?? null,
    })
  } catch (err) {
    console.error('POST generate/stream error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
