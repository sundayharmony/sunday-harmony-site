import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { deleteDisputeSession } from '@/lib/dispute-letters/db'
import { removeDisputeSessionStorage } from '@/lib/dispute-letters-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const data = await disputeLettersJson(`/internal/reports/${id}`)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load report'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/** Delete a report history session (storage + DB). Use when a wrong file was uploaded. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    await removeDisputeSessionStorage(id, access.session.storage_path)
    const deleted = await deleteDisputeSession(id)
    if (!deleted.ok) {
      return NextResponse.json({ error: deleted.error }, { status: 500 })
    }
    return NextResponse.json({ ok: true, session_id: id })
  } catch (err) {
    console.error('DELETE dispute session error:', err)
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
  }
}
