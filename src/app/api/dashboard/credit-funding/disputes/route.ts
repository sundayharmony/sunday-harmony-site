import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { requireApplicantCreditFundingAccess } from '@/lib/credit-funding-dashboard-auth'
import {
  sanitizeStorageFileName,
  uploadClientFileToVault,
  validateClientFile,
} from '@/lib/client-files-storage'
import {
  createDisputeResponse,
  loadReleasedRoundsForApplication,
} from '@/lib/dispute-letters/dispute-lifecycle-db'
import { getSupabase } from '@/lib/supabase'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET — released dispute rounds + items + responses for the applicant's application. */
export async function GET() {
  try {
    const access = await requireApplicantCreditFundingAccess()
    if (!access.ok) return access.response

    const data = await loadReleasedRoundsForApplication(access.application.id)
    return NextResponse.json(data)
  } catch (error) {
    logApiRouteError(
      { url: '/api/dashboard/credit-funding/disputes' } as NextRequest,
      'dashboard/credit-funding/disputes GET',
      error
    )
    return NextResponse.json({ error: 'Failed to load dispute rounds' }, { status: 500 })
  }
}

/** POST multipart — client uploads a bureau response for a released round. */
export async function POST(req: NextRequest) {
  try {
    const access = await requireApplicantCreditFundingAccess()
    if (!access.ok) return access.response

    const { session, application } = access
    const rl = await rateLimitDurable(
      `dashboard-credit-funding-disputes:${session.user.id}`,
      20,
      15 * 60 * 1000
    )
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const formData = await req.formData()
    const roundId = String(formData.get('roundId') || '').trim()
    const file = formData.get('file')
    const notesRaw = formData.get('notes')
    const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : null

    if (!roundId) {
      return NextResponse.json({ error: 'roundId is required' }, { status: 400 })
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const released = await loadReleasedRoundsForApplication(application.id)
    const round = released.rounds.find((r) => r.id === roundId)
    if (!round) {
      // Extra check: ensure round belongs to this application's case even if not loaded
      const { data: caseRow } = await getSupabase()
        .from('dispute_cases')
        .select('id')
        .eq('application_uuid', application.id)
        .maybeSingle()
      if (!caseRow?.id) {
        return NextResponse.json({ error: 'Round not found or not released' }, { status: 404 })
      }
      const { data: roundRow } = await getSupabase()
        .from('dispute_rounds')
        .select('id, client_released_at, case_id')
        .eq('id', roundId)
        .eq('case_id', caseRow.id)
        .maybeSingle()
      if (!roundRow?.client_released_at) {
        return NextResponse.json({ error: 'Round not found or not released' }, { status: 404 })
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || 'application/octet-stream'
    const v = validateClientFile(contentType, buffer.length)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

    const up = await uploadClientFileToVault({
      clientId: `dispute-responses/${roundId}`,
      buffer,
      contentType,
      originalFileName: file.name || sanitizeStorageFileName('response.pdf'),
    })
    if (!up.ok) {
      return NextResponse.json({ error: up.error }, { status: 400 })
    }

    const created = await createDisputeResponse({
      roundId,
      source: 'bureau',
      fileName: up.data.displayName,
      storagePath: up.data.objectPath,
      notes,
      uploadedBy: session.user.email || application.email || 'client',
    })
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, response: created.row })
  } catch (error) {
    logApiRouteError(req, 'dashboard/credit-funding/disputes POST', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
