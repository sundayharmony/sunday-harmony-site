import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { proxyDisputeLettersStream } from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { updateDisputeSessionStatus } from '@/lib/dispute-letters/db'
import {
  removeDisputeReportObject,
  verifyDisputeReportObject,
} from '@/lib/dispute-letters-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = await request.json()
    const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : ''

    if (!storagePath || storagePath !== access.session.storage_path) {
      return NextResponse.json({ error: 'Invalid report storage path' }, { status: 400 })
    }

    const verification = await verifyDisputeReportObject({
      storagePath,
      sessionId: id,
      originalFileName: access.session.file_name,
    })
    if (!verification.ok) {
      await removeDisputeReportObject(storagePath)
      await updateDisputeSessionStatus(id, 'failed', verification.error)
      return NextResponse.json({ error: verification.error }, { status: 400 })
    }

    await updateDisputeSessionStatus(id, 'analyzing')

    return proxyDisputeLettersStream('/internal/analyze/stream', {
      session_id: id,
      storage_path: storagePath,
      file_name: access.session.file_name,
    })
  } catch (err) {
    console.error('POST analyze/stream error:', err)
    await updateDisputeSessionStatus(id, 'failed', 'Analysis failed')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
