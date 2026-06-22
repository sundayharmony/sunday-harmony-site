import { Resend } from 'resend'

let client: Resend | null = null

export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  if (!client) client = new Resend(key)
  return client
}

export function isResendWebhookConfigured(): boolean {
  return Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim() && process.env.RESEND_API_KEY?.trim())
}
