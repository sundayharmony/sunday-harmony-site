import { NextRequest, NextResponse } from 'next/server'
import { evaluateActivationBlockers, mailingAddressIsValid, sendsPermitted } from '@/lib/outreach/activation'
import { buildOutreachConsole } from '@/lib/outreach/console'
import { isSameOriginRequest } from '@/lib/outreach/csrf'
import { draftContentSha256 } from '@/lib/outreach/draft-shell'
import { enqueueFromStoreCandidates } from '@/lib/outreach/enqueue'
import { currentBlockers, resolveOutreachStore, senderConfiguredHere } from '@/lib/outreach/runtime'
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
        error: 'Outreach store is unavailable. Migration may be unapplied.',
        blockers: currentBlockers(),
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
  let body: { action?: string } = {}
  try {
    body = (await request.json()) as { action?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.action === 'enqueue') {
    const session = await requireSalesSession()
    if (session instanceof NextResponse) return session
    const store = resolveOutreachStore()
    const result = await enqueueFromStoreCandidates(store, { actor: session.user.email || session.user.id })
    return NextResponse.json({ ok: true, enqueueOnly: true, sent: 0, ...result })
  }

  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  const store = resolveOutreachStore()

  if (body.action === 'approve-template') {
    const campaign = await store.getCampaignBySlug('prospect-intro')
    const template = campaign ? await store.getLatestTemplate(campaign.id) : null
    if (!template) return NextResponse.json({ error: 'Template missing' }, { status: 400 })
    const approved = await store.approveTemplate(
      template.id,
      session.user.id,
      draftContentSha256(),
      store.now()
    )
    await store.addAudit({
      actorType: 'staff',
      actorId: session.user.id,
      action: approved ? 'template_approved' : 'template_approve_rejected',
      entityType: 'template',
      entityId: template.id,
      payload: { sha: draftContentSha256() },
    })
    return NextResponse.json({
      ok: Boolean(approved),
      approved: Boolean(approved?.approved),
      stillDisabled: true,
      blockers: currentBlockers(await store.getSettings(), approved || template),
    })
  }

  if (body.action === 'activate') {
    const settings = await store.getSettings()
    const campaign = await store.getCampaignBySlug('prospect-intro')
    const template = campaign ? await store.getLatestTemplate(campaign.id) : null
    const blockers = evaluateActivationBlockers({
      settings,
      template,
      senderConfigured: senderConfiguredHere(),
      unsubscribeRoutePresent: true,
    })
    await store.addAudit({
      actorType: 'staff',
      actorId: session.user.id,
      action: 'activation_attempt_blocked',
      entityType: 'settings',
      entityId: '1',
      payload: { blockers: blockers.map((item) => item.code) },
    })
    if (!sendsPermitted({ settings, template, senderConfigured: senderConfiguredHere(), unsubscribeRoutePresent: true })) {
      return NextResponse.json({
        ok: false,
        activated: false,
        blockers,
        mailingAddressPresent: mailingAddressIsValid(settings.physicalMailingAddress),
      }, { status: 409 })
    }
    return NextResponse.json({ ok: false, activated: false, blockers }, { status: 409 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
