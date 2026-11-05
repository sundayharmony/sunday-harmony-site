import { NextRequest, NextResponse } from 'next/server'
import { verifyProviderWebhookSignature } from '@/lib/outreach/csrf'
import { resolveOutreachStore } from '@/lib/outreach/runtime'

export const dynamic = 'force-dynamic'

/**
 * Future provider event ingest. Not registered with any sender.
 * Signature required. Never sends mail. Does not mark leads contacted.
 */
export async function POST(request: NextRequest) {
  const payload = await request.text()
  const secret = process.env.OUTREACH_PROVIDER_WEBHOOK_SECRET?.trim() || null
  const signature =
    request.headers.get('x-outreach-signature') ||
    request.headers.get('svix-signature') ||
    request.headers.get('x-resend-signature')
  if (!verifyProviderWebhookSignature({ payload, signature, secret })) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { type?: string; providerMessageId?: string; emailId?: string } = {}
  try {
    event = JSON.parse(payload) as { type?: string; providerMessageId?: string; emailId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const store = resolveOutreachStore()
  const messageId = event.providerMessageId || event.emailId
  const queue = await store.listQueue()
  const match = queue.find((item) => item.providerMessageId && item.providerMessageId === messageId)
  if (match && event.type === 'delivered') {
    await store.compareAndSwap(match.id, match.status, {
      status: 'delivered',
      deliveredAt: store.now().toISOString(),
    })
  } else if (match && (event.type === 'bounced' || event.type === 'complained')) {
    await store.compareAndSwap(match.id, match.status, {
      status: 'bounced',
      bouncedAt: store.now().toISOString(),
    })
    await store.addSuppression({
      emailNormalized: match.emailNormalized,
      reason: event.type === 'complained' ? 'complaint' : 'hard_bounce',
      source: 'provider',
      confirmationStatus: 'confirmed',
      notes: `provider event ${event.type}`,
    })
  }

  await store.addAudit({
    actorType: 'provider',
    actorId: 'webhook',
    action: 'provider_event',
    entityType: 'queue',
    entityId: match?.id || null,
    payload: { type: event.type || 'unknown', liveSend: false },
  })
  return NextResponse.json({ ok: true, sent: 0 })
}
