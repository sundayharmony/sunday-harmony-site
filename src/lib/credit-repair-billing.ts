import type Stripe from 'stripe'
import type { Client } from '@/lib/db'
import { updateClientForStripeSync } from '@/lib/stripe-subscription-sync'

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
