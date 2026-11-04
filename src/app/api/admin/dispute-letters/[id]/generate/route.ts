import { after, NextRequest, NextResponse } from 'next/server'
import { requireCreditFundingStaffSession } from '@/lib/stripe-admin-auth'
import { checkDisputeLettersHealth, disputeLettersJson } from '@/lib/dispute-letters/api-client'
import { letterGenerateFailure, type LetterGenerateJob } from '@/lib/dispute-letters/generate-job'
import { loadLetterConsumerIdentity } from '@/lib/dispute-letters/letter-consumer-identity'
import { requireDisputeSessionAccess } from '@/lib/dispute-letters/session-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Generate poll + post-complete ZIP pregeneration (after()). */
export const maxDuration = 180

type Params = { params: Promise<{ id: string }> }

/**
 * Start letter generation in the background on the Python API.
 * Client should poll GET until complete/failed.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const body = await request.json().catch(() => ({}))
    const identity = await loadLetterConsumerIdentity(id)
    const payload = JSON.stringify({
      session_id: id,
      plan_ids: body.plan_ids ?? null,
      consumer_name: body.consumer_name ?? null,
      consumer_addresses: body.consumer_addresses ?? null,
      consumer_ssn: identity.ssn,
      consumer_dob: identity.dob,
    })

    await checkDisputeLettersHealth(45_000).catch(() => false)

    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const data = await disputeLettersJson<{
          status: string
          session_id: string
          message?: string
        }>('/internal/letters/generate/start', {
          method: 'POST',
          signal: AbortSignal.timeout(20_000),
          body: payload,
        })
        return NextResponse.json(data, { status: 202 })
      } catch (err) {
        lastError = err
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Letter generation failed to start')
  } catch (err) {
    console.error('POST generate error:', err)
    const message = err instanceof Error ? err.message : 'Letter generation failed to start'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireCreditFundingStaffSession()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const access = await requireDisputeSessionAccess(id, session)
  if (!access.ok) return access.response

  try {
    const data = await disputeLettersJson<LetterGenerateJob>(`/internal/letter-jobs/${id}`, {
      signal: AbortSignal.timeout(20_000),
    })
    if (data.status === 'complete') {
      try {
        const { onLettersGenerated } = await import('@/lib/dispute-letters/dispute-lifecycle-db')
        await onLettersGenerated(id)
      } catch (hookErr) {
        console.error('onLettersGenerated hook failed:', hookErr)
      }
      // Eager ZIP build so Download ZIP is a storage fetch, not a live DOCX merge.
      after(() => {
        import('@/lib/dispute-letters/letter-package-zip')
          .then(({ prepareLetterPackageZip }) => prepareLetterPackageZip(id))
          .catch((err) => console.error('prepareLetterPackageZip after generate failed:', err))
      })
    }
    const failure = letterGenerateFailure(data)
    if (failure && (data.status === 'failed' || data.status === 'error')) {
      return NextResponse.json({ ...data, error_message: failure })
    }
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load letter generation status'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
