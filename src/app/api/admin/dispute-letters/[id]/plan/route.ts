import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const data = await disputeLettersJson('/internal/disputes/plan', {
      method: 'POST',
      body: JSON.stringify({ ...body, session_id: id }),
    })
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build plan'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
