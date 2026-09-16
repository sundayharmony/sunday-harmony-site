import type Stripe from 'stripe'
import type { Client } from '@/lib/db'
import { updateClientForStripeSync } from '@/lib/stripe-subscription-sync'

// Client components import helpers from this file. Keep Node mail delivery in
// credit-repair-invoice-email.ts so the production client bundle can compile.

export const BILLING_MODELS = ['marketing_subscription', 'credit_repair_one_time'] as const
export type BillingModel = (typeof BILLING_MODELS)[number]

export const CREDIT_REPAIR_LEAD_TYPES = ['credit_repair_lead', 'credit_repair_funding'] as const
export type CreditRepairLeadType = (typeof CREDIT_REPAIR_LEAD_TYPES)[number]

export const CREDIT_REPAIR_SERVICE_TYPES = ['credit_repair', 'credit_and_funding'] as const

export const CREDIT_REPAIR_FEE_MIN_CENTS = 100
export const CREDIT_REPAIR_FEE_MAX_CENTS = 5_000_000

export type CreditRepairBillingClient = Pick<
  Client,
  | 'billing_model'
  | 'lead_type'
  | 'stripe_subscription_id'
  | 'billing_status'
  | 'repair_fee_cents'
  | 'repair_fee_paid_at'
  | 'stripe_repair_invoice_id'
  | 'is_potential'
>

export function isCreditRepairLeadType(leadType?: string | null): leadType is CreditRepairLeadType {
  return CREDIT_REPAIR_LEAD_TYPES.includes(leadType as CreditRepairLeadType)
}

export function isCreditRepairServiceType(serviceType?: string | null): boolean {
  return CREDIT_REPAIR_SERVICE_TYPES.includes(serviceType as (typeof CREDIT_REPAIR_SERVICE_TYPES)[number])
}

export function billingModelForCreditApplication(input: {
  lead_type?: string | null
  service_type?: string | null
}): BillingModel {
  if (isCreditRepairLeadType(input.lead_type) || isCreditRepairServiceType(input.service_type)) {
    return 'credit_repair_one_time'
  }
  return 'marketing_subscription'
}

export function isCreditRepairBillingClient(client: {
  billing_model?: string | null
  lead_type?: string | null
}): boolean {
  if (client.billing_model === 'credit_repair_one_time') return true
  return isCreditRepairLeadType(client.lead_type)
}

export function billingRequiresActivation(client: {
  billing_model?: string | null
  lead_type?: string | null
}): boolean {
  return !isCreditRepairBillingClient(client)
}

export function defaultRepairFeeCents(): number | null {
  const raw = process.env.CREDIT_REPAIR_DEFAULT_FEE_CENTS?.trim()
  if (!raw) return null
  const cents = Number.parseInt(raw, 10)
  if (!Number.isFinite(cents) || cents < CREDIT_REPAIR_FEE_MIN_CENTS || cents > CREDIT_REPAIR_FEE_MAX_CENTS) {
    return null
  }
  return cents
}

export function formatRepairFeeCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Parse a dollar amount typed by staff into Stripe cents. */
export function parseRepairFeeToCents(raw: unknown): { cents: number } | { error: string } {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { error: 'Enter a valid repair fee.' }
    return validateRepairFeeCents(Math.round(raw * 100))
  }
  if (typeof raw !== 'string') return { error: 'Enter a repair fee amount.' }
  const cleaned = raw.trim().replace(/[$,]/g, '')
  if (!cleaned) return { error: 'Enter a repair fee amount.' }
  const dollars = Number.parseFloat(cleaned)
  if (!Number.isFinite(dollars)) return { error: 'Enter a valid repair fee.' }
  return validateRepairFeeCents(Math.round(dollars * 100))
}

function validateRepairFeeCents(cents: number): { cents: number } | { error: string } {
  if (!Number.isInteger(cents) || cents < CREDIT_REPAIR_FEE_MIN_CENTS) {
    return { error: 'Repair fee must be at least $1.00.' }
  }
  if (cents > CREDIT_REPAIR_FEE_MAX_CENTS) {
    return { error: 'Repair fee cannot exceed $50,000.' }
  }
  return { cents }
}

export function resolveRepairCollectionMode(input: {
  preferSendInvoice?: boolean
  hasCard: boolean
}): 'charge_card' | 'send_invoice' {
  if (input.preferSendInvoice || !input.hasCard) return 'send_invoice'
  return 'charge_card'
}

export function repairInvoiceMetadata(input: {
  clientId: string
  emailReceiptOnPay: boolean
}): Record<string, string> {
  return {
    client_id: input.clientId,
    billing_model: 'credit_repair_one_time',
    email_receipt_on_pay: input.emailReceiptOnPay ? 'true' : 'false',
  }
}

/** Webhook sends a receipt when the client pays an emailed invoice later. Card-on-file charges email in-request. */
export function shouldEmailRepairReceiptOnPay(invoice: Stripe.Invoice): boolean {
  return invoice.metadata?.email_receipt_on_pay !== 'false'
}

function escInvoiceHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildRepairInvoiceEmail(input: {
  clientName: string
  amountCents: number
  paid: boolean
  hostedInvoiceUrl?: string | null
  invoiceNumber?: string | null
}): { subject: string; html: string } {
  const amount = formatRepairFeeCents(input.amountCents)
  const first = escInvoiceHtml(input.clientName.trim().split(/\s+/)[0] || 'there')
  const numberLabel = input.invoiceNumber ? `Invoice ${escInvoiceHtml(input.invoiceNumber)}` : 'Your invoice'
  const subject = input.paid
    ? `Receipt: ${amount} credit repair — Sunday Harmony`
    : `Invoice: ${amount} credit repair — Sunday Harmony`
  const intro = input.paid
    ? `We received your ${amount} credit repair payment. Keep this email as your receipt.`
    : `Here is your ${amount} credit repair invoice. Pay securely with the button below.`
  const cta = input.paid ? 'View receipt' : 'Pay invoice'
  const url = input.hostedInvoiceUrl?.trim() || ''
  const button = url
    ? `<p style="text-align:center;margin:28px 0">
        <a href="${escInvoiceHtml(url)}" style="background:#c9a96e;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${escInvoiceHtml(cta)}</a>
      </p>`
    : ''

  return {
    subject,
    html: `
      <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#c9a96e;border-bottom:2px solid #c9a96e;padding-bottom:10px">Credit repair ${input.paid ? 'receipt' : 'invoice'}</h2>
        <p>Hi ${first},</p>
        <p>${escInvoiceHtml(intro)}</p>
        <p style="padding:12px;background:#fafafa;border-radius:8px;font-size:14px"><strong>${numberLabel}</strong> · ${escInvoiceHtml(amount)}</p>
        ${button}
        <p style="font-size:13px;color:#666;margin-top:20px;padding-top:15px;border-top:1px solid #eee">&mdash; Sunday Harmony</p>
      </div>
    `,
  }
}

export function isRepairInvoice(invoice: Stripe.Invoice, client?: { billing_model?: string | null; lead_type?: string | null }): boolean {
  if (invoice.metadata?.billing_model === 'credit_repair_one_time') return true
  return Boolean(client && isCreditRepairBillingClient(client))
}

export async function applyRepairInvoicePaid(clientId: string, invoice: Stripe.Invoice): Promise<void> {
  const paidAtRaw = invoice.status_transitions?.paid_at
  const paidAt =
    typeof paidAtRaw === 'number' && !Number.isNaN(paidAtRaw)
      ? new Date(paidAtRaw * 1000).toISOString()
      : new Date().toISOString()
  const amount = invoice.amount_paid > 0 ? invoice.amount_paid : invoice.amount_due

  await updateClientForStripeSync(clientId, {
    billing_model: 'credit_repair_one_time',
    billing_status: 'paid',
    is_potential: false,
    monthly_price: 0,
    last_payment_at: paidAt,
    repair_fee_paid_at: paidAt,
    repair_fee_cents: amount,
    stripe_repair_invoice_id: invoice.id,
    next_billing_date: undefined,
  })
}
