import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { createUser, getUserByEmail } from '@/lib/db'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { ensureClientFromCreditApplication } from '@/lib/crm-db'
import {
  createClientStartDraft,
  deleteCreditFundingApplication,
  getBlockingIncompleteApplicationByEmail,
  linkApplicationToUser,
} from '@/lib/credit-funding-db'
import {
  assertHttpsSubmission,
  parseIntakePayload,
  validateCreditAccountStart,
} from '@/lib/credit-funding-validation'
import { hasHoneypotValue } from '@/lib/honeypot'
import { CREDIT_START_CONFLICT, creditEmailRateLimit } from '@/lib/public-form-guards'
import { readTurnstileToken, turnstileFailureResponse, verifyTurnstile } from '@/lib/turnstile'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Basic identity plus a portal password. The rest of the file is finished after sign-in. */
export async function POST(req: NextRequest) {
  try {
    if (!assertHttpsSubmission(req)) {
      return NextResponse.json({ error: 'HTTPS is required' }, { status: 403 })
    }

    const body = await req.json()
    if (hasHoneypotValue(body)) {
      return NextResponse.json({ error: 'Unable to process submission' }, { status: 400 })
    }

    const payload = parseIntakePayload(body as Record<string, unknown>)
    const password = typeof body.password === 'string' ? body.password : ''
    const invalid = validateCreditAccountStart(payload, password)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const ip = getClientIp(req)
    const rl = await rateLimitDurable(`credit-start:${ip}`, 8, 60 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const human = await verifyTurnstile({ token: readTurnstileToken(body), action: 'credit_start', remoteIp: ip })
    if (!human.ok) return turnstileFailureResponse(human)

    const perEmail = await creditEmailRateLimit(payload.email)
    if (!perEmail.allowed) return rateLimitResponse(perEmail.resetIn)

    // Same status and body for both cases so this endpoint does not reveal which emails have accounts.
    if ((await getUserByEmail(payload.email)) || (await getBlockingIncompleteApplicationByEmail(payload.email))) {
      return NextResponse.json(CREDIT_START_CONFLICT.body, { status: CREDIT_START_CONFLICT.status })
    }

    const draft = await createClientStartDraft(payload)
    if (!draft) {
      return NextResponse.json({ error: 'Could not start your file. Please try again.' }, { status: 500 })
    }

    const client = await ensureClientFromCreditApplication(draft)
    if (!client) {
      await deleteCreditFundingApplication(draft.id)
      return NextResponse.json({ error: 'Could not start your file. Please try again.' }, { status: 500 })
    }

    const user = await createUser({
      email: payload.email,
      password,
      name: payload.fullName,
      role: 'client',
      client_id: client.id,
    })
    if (!user) {
      await deleteCreditFundingApplication(draft.id)
      return NextResponse.json({ error: 'Could not create your account. Please try again.' }, { status: 500 })
    }

    await linkApplicationToUser(draft.id, user.id, client.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logApiRouteError(req, 'credit-funding/start', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
