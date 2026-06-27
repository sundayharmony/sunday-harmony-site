import type Stripe from 'stripe'

export function normalizeStripeInvoice(inv: Stripe.Invoice) {
  const paidAt = inv.status_transitions?.paid_at
  const paidAtMs =
    typeof paidAt === 'number' && !Number.isNaN(paidAt) ? paidAt * 1000 : null

  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amount_paid: inv.amount_paid,
    amount_due: inv.amount_due,
    currency: inv.currency,
    hosted_invoice_url: inv.hosted_invoice_url,
    invoice_pdf: inv.invoice_pdf,
    created: inv.created,
    period_start: inv.period_start,
    period_end: inv.period_end,
    paid_at: paidAtMs ? new Date(paidAtMs).toISOString() : null,
  }
}
