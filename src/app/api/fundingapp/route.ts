import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { createCreditFundingApplication } from '@/lib/credit-funding-db'
import { runCreditFundingSubmissionSideEffects } from '@/lib/credit-funding-finalize'
import { assertHttpsSubmission } from '@/lib/credit-funding-validation'
import { buildFundingAppSubmission } from '@/lib/fundingapp'
import { parseFundingAppInput } from '@/lib/fundingapp-fields'
import { hasHoneypotValue } from '@/lib/honeypot'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    if (!assertHttpsSubmission(req)) {
      return NextResponse.json({ error: 'A secure connection is required.' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Enter the application details.' }, { status: 400 })
    }

    if (hasHoneypotValue(body as Record<string, unknown>)) {
      return NextResponse.json({ error: 'Unable to process submission' }, { status: 400 })
    }

    const parsed = parseFundingAppInput(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const ip = getClientIp(req)
    const rl = await rateLimitDurable(`fundingapp:v1:${ip}`, 8, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const submission = buildFundingAppSubmission(parsed.value)
    const application = await createCreditFundingApplication(submission.payload, undefined, {
      draftSource: submission.draftSource,
      fundingGoals: submission.fundingGoals,
    })
    if (!application) {
      return NextResponse.json({ error: 'Failed to save application. Please try again.' }, { status: 500 })
    }

    await runCreditFundingSubmissionSideEffects({
      application,
      payload: submission.payload,
      activityDetails: `Funding application submitted via /fundingapp: ${application.application_id}`,
    })

    return NextResponse.json({ ok: true, applicationId: application.application_id })
  } catch (error) {
    logApiRouteError(req, 'fundingapp POST', error)
    return NextResponse.json({ error: 'Failed to save application. Please try again.' }, { status: 500 })
  }
}
