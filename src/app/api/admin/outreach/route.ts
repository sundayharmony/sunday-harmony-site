import { NextRequest, NextResponse } from 'next/server'
import {
  approveLatestTemplate,
  attemptActivation,
  reconcileHistory,
  runOptOutVerification,
  saveOperatorSettings,
  setDatabaseKillSwitch,
} from '@/lib/outreach/admin-actions'
import { buildOutreachConsole } from '@/lib/outreach/console'
import { isSameOriginRequest } from '@/lib/outreach/csrf'
import { dispatchOutreachBatch } from '@/lib/outreach/dispatch'
import { ensureReadyQueue } from '@/lib/outreach/enqueue'
import { discoverEmailFromWebsite } from '@/lib/outreach/website-email'
import { currentBlockers, defaultDisabledSettings, resolveOutreachStore } from '@/lib/outreach/runtime'
import {
  OUTREACH_MANUAL_SEND_MAX,
  OUTREACH_PAGE_ENQUEUE_CAP,
  OUTREACH_READY_QUEUE_SIZE,
  OUTREACH_SEND_LIMIT,
} from '@/lib/outreach/constants'
import { requireAdminSession, requireSalesSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'
/** Batch Gmail sends need headroom beyond the default serverless limit. */
export const maxDuration = 180

function manualSendLimitFromBody(body: Record<string, unknown>, action: string) {
  const defaultLimit = action === 'send' ? 1 : OUTREACH_SEND_LIMIT
  const raw = body.count ?? body.limit ?? defaultLimit
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? Number.parseInt(raw, 10)
        : defaultLimit
  if (!Number.isFinite(parsed) || parsed < 1) return defaultLimit
  return Math.min(Math.floor(parsed), OUTREACH_MANUAL_SEND_MAX)
}

function humanizeDispatchDetails(details: string[]): string {
  const counts = new Map<string, number>()
  for (const detail of details) {
    const key = detail.split(':')[0] || detail
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const parts = [...counts.entries()].map(([code, count]) =>
    count > 1 ? `${code} ×${count}` : code
  )
  return parts.slice(0, 4).join(', ')
}

export async function GET() {
  const session = await requireSalesSession()
  if (session instanceof NextResponse) return session
  try {
    const store = resolveOutreachStore()
    let topUp: {
      enqueued: number
      released: number
      recovered: number
      ineligible?: number
      blockedReview?: number
      skipped?: number
      reasons?: Record<string, number>
    } = { enqueued: 0, released: 0, recovered: 0 }
    if (session.user.role === 'admin') {
      // Automatic desk top-up: recover soft failures, then draft toward the ready target.
      const refill = await ensureReadyQueue(store, {
        actor: session.user.email || session.user.id,
        maxCandidates: OUTREACH_PAGE_ENQUEUE_CAP,
        refreshLimit: OUTREACH_READY_QUEUE_SIZE,
        releaseSoftRetries: true,
        recoverStuck: true,
        discoverWebsiteEmail: discoverEmailFromWebsite,
      })
      topUp = {
        enqueued: refill.enqueued,
        released: refill.released,
        recovered: refill.recovered,
        ineligible: refill.ineligible,
        blockedReview: refill.blockedReview,
        skipped: refill.skipped,
        reasons: refill.reasons,
      }
      console.log(
        'outreach top-up',
        JSON.stringify({
          enqueued: topUp.enqueued,
          recovered: topUp.recovered,
          released: topUp.released,
          ineligible: topUp.ineligible,
          blocked: topUp.blockedReview,
          skipped: topUp.skipped,
          reasons: topUp.reasons,
        })
      )
    }
    const payload = await buildOutreachConsole(store, session.user.role ?? null)
    return NextResponse.json({ ...payload, topUp })
  } catch (error) {
    const message = 'Outreach store is unavailable. Migration may be unapplied.'
    return NextResponse.json(
      {
        disabled: true,
        liveSend: false,
        storage: 'unavailable',
        senderConfigured: false,
        canOperate: session.user.role === 'admin',
        attachmentPresent: false,
        readyCount: 0,
        readyTarget: OUTREACH_READY_QUEUE_SIZE,
        manualSendMax: OUTREACH_MANUAL_SEND_MAX,
        next: null,
        sent: [],
        settings: defaultDisabledSettings(),
        template: null,
        reconciliation: [],
        provider: {
          intended: 'gmail',
          idempotencyRecovery: false,
          note: message,
        },
        error: message,
        blockers: currentBlockers(undefined, undefined, { schemaReady: false }),
        detail: error instanceof Error ? error.message : 'unknown',
      },
      { status: 200 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
  }
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const action = typeof body.action === 'string' ? body.action : ''

  if (action === 'enqueue') {
    const session = await requireSalesSession()
    if (session instanceof NextResponse) return session
    const store = resolveOutreachStore()
    const result = await ensureReadyQueue(store, { actor: session.user.email || session.user.id })
    return NextResponse.json({ ok: true, enqueueOnly: true, sent: 0, liveSend: false, ...result })
  }

  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  const store = resolveOutreachStore()
  const actorId = session.user.id

  if (action === 'approve-template') {
    const result = await approveLatestTemplate(store, actorId)
    return NextResponse.json(result.body, { status: result.status })
  }

  if (action === 'update-settings') {
    const result = await saveOperatorSettings(store, body, actorId)
    return NextResponse.json(result.body, { status: result.status })
  }

  if (action === 'set-kill-switch') {
    const result = await setDatabaseKillSwitch(store, body.killSwitch === true, actorId)
    return NextResponse.json(result.body, { status: result.status })
  }

  if (action === 'verify-opt-out') {
    const result = await runOptOutVerification(store, actorId)
    return NextResponse.json(result.body, { status: result.status })
  }

  if (action === 'reconcile-history') {
    const result = await reconcileHistory(store, body, actorId)
    return NextResponse.json(result.body, { status: result.status })
  }

  if (action === 'activate') {
    const result = await attemptActivation(store, { actorId, clientBody: body })
    return NextResponse.json(result.body, { status: result.status })
  }

  if (action === 'send' || action === 'send-batch') {
    const limit = manualSendLimitFromBody(body, action)
    const result = await dispatchOutreachBatch({
      store,
      workerId: `admin-send:${actorId}`,
      limit,
      ignoreBackoff: true,
    })
    const refill = await ensureReadyQueue(store, {
      actor: actorId,
      releaseSoftRetries: true,
      recoverStuck: true,
    })
    const detailSummary = humanizeDispatchDetails(result.details)
    return NextResponse.json({
      ok: true,
      ...result,
      // Keep `sent` as accepted count after spreading result (result has `accepted`, not `sent`).
      sent: result.accepted,
      refilled: refill.enqueued,
      released: refill.released,
      recovered: refill.recovered,
      liveSend: !result.skippedDisabled,
      message:
        result.accepted > 0
          ? undefined
          : result.blockers[0]?.message ||
            (detailSummary
              ? `Not sent (${detailSummary}).`
              : 'Not sent. No claimable letter was in the ready queue.'),
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
