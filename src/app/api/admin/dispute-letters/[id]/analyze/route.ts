import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  checkDisputeLettersHealth,
  disputeLettersJson,
  friendlyDisputeLettersUpstreamError,
} from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { updateDisputeSessionStatus } from '@/lib/dispute-letters/db'
import {
  removeDisputeReportObject,
  verifyDisputeReportObject,
} from '@/lib/dispute-letters-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

/**
 * Start Credit Intelligence analysis in the background on the Python API.
 * Client should poll GET /api/admin/dispute-letters/[id]/status until ready/failed.
 */
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

    // Wake a sleeping free-tier Render instance before kicking off analysis.
    await checkDisputeLettersHealth().catch(() => false)

    await updateDisputeSessionStatus(id, 'analyzing')

    const data = await disputeLettersJson<{
      status: string
      session_id: string
      message?: string
    }>('/internal/analyze/start', {
      method: 'POST',
      body: JSON.stringify({
        session_id: id,
        storage_path: storagePath,
        file_name: access.session.file_name,
      }),
    })

    return NextResponse.json(data, { status: 202 })
  } catch (err) {
    console.error('POST analyze error:', err)
    const message =
      err instanceof Error
        ? friendlyDisputeLettersUpstreamError(err.message, 502)
        : 'Analysis failed to start'
    await updateDisputeSessionStatus(id, 'failed', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
