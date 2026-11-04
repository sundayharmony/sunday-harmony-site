import { NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import {
  checkDisputeLettersHealth,
  disputeLettersJson,
  friendlyDisputeLettersUpstreamError,
} from '@/lib/dispute-letters/api-client'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'
import { getDisputeSessionById, updateDisputeSessionStatus } from '@/lib/dispute-letters/db'
import {
  removeDisputeReportObject,
  verifyDisputeReportObject,
} from '@/lib/dispute-letters-storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

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

    // Free-tier Render often needs most of a minute to wake. Wait that out here,
    // then accept the job. A timed-out start is not a failure if the job is already running.
    await checkDisputeLettersHealth(45_000).catch(() => false)

    try {
      const cfg = await disputeLettersJson<{
        supabase_ok?: boolean
        supabase_error?: string | null
        supabase_configured?: boolean
      }>('/config', { signal: AbortSignal.timeout(8_000) })
      if (cfg.supabase_configured === false || cfg.supabase_ok === false) {
        const detail =
          cfg.supabase_error ||
          'Render analysis API is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (must match Vercel).'
        await updateDisputeSessionStatus(id, 'failed', detail)
        return NextResponse.json({ error: detail }, { status: 503 })
      }
    } catch {
      // A slow /config after wake should not fail the upload. Start still checks Supabase.
    }

    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const data = await disputeLettersJson<{
          status: string
          session_id: string
          message?: string
        }>('/internal/analyze/start', {
          method: 'POST',
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            session_id: id,
            storage_path: storagePath,
            file_name: access.session.file_name,
          }),
        })
        return NextResponse.json(data, { status: 202 })
      } catch (err) {
        lastError = err
        const latest = await getDisputeSessionById(id)
        if (latest?.status === 'analyzing' || latest?.status === 'ready') {
          return NextResponse.json({ status: latest.status, session_id: id }, { status: 202 })
        }
      }
    }

    const accepted = await getDisputeSessionById(id)
    if (accepted?.status === 'analyzing' || accepted?.status === 'ready') {
      return NextResponse.json({ status: accepted.status, session_id: id }, { status: 202 })
    }

    const message =
      lastError instanceof Error
        ? friendlyDisputeLettersUpstreamError(lastError.message, 502)
        : 'Analysis failed to start'
    await updateDisputeSessionStatus(id, 'failed', message)
    return NextResponse.json({ error: message }, { status: 502 })
  } catch (err) {
    console.error('POST analyze error:', err)
    const message =
      err instanceof Error
        ? friendlyDisputeLettersUpstreamError(err.message, 502)
        : 'Analysis failed to start'
    const latest = await getDisputeSessionById(id).catch(() => null)
    if (latest?.status === 'analyzing' || latest?.status === 'ready') {
      return NextResponse.json({ status: latest.status, session_id: id }, { status: 202 })
    }
    await updateDisputeSessionStatus(id, 'failed', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
