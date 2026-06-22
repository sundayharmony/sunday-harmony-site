import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { processInboundEmail } from '@/lib/inbound-email-service'
import { getResendClient, isResendWebhookConfigured } from '@/lib/resend-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isResendWebhookConfigured()) {
      return NextResponse.json({ error: 'Resend webhook not configured' }, { status: 503 })
    }

    const payload = await req.text()
    const resend = getResendClient()

    let event
    try {
      event = resend.webhooks.verify({
        payload,
        headers: {
          id: req.headers.get('svix-id') ?? '',
          timestamp: req.headers.get('svix-timestamp') ?? '',
          signature: req.headers.get('svix-signature') ?? '',
        },
        webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
      })
    } catch (err) {
      logApiRouteError(req, 'resend webhook verify', err)
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }

    if (event.type === 'email.received') {
      const data = event.data as {
        email_id: string
        from: string
        to: string[]
        subject?: string
      }
      await processInboundEmail({
        email_id: data.email_id,
        from: data.from,
        to: data.to,
        subject: data.subject,
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logApiRouteError(req, 'resend webhook', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
