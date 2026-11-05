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
import { enqueueFromStoreCandidates } from '@/lib/outreach/enqueue'
import { currentBlockers, resolveOutreachStore } from '@/lib/outreach/runtime'
import { requireAdminSession, requireSalesSession } from '@/lib/stripe-admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await requireSalesSession()
  if (session instanceof NextResponse) return session
  try {
    const store = resolveOutreachStore()
    const payload = await buildOutreachConsole(store, session.user.role ?? null)
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        disabled: true,
        liveSend: false,
        error: 'Outreach store is unavailable. Migration may be unapplied.',
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
    const result = await enqueueFromStoreCandidates(store, { actor: session.user.email || session.user.id })
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
