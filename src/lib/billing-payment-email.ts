import type Stripe from 'stripe'
import {
  getAdminNotifyEmail,
  isEmailConfigured,
  sanitizeEmailSubjectPart,
  sendEmail,
  staffPortalEmailHtml,
} from '@/lib/smtp-mail'
import { formatRepairFeeCents } from '@/lib/credit-repair-billing'

export type PaymentProcessedKind = 'credit_repair' | 'subscription' | 'payment'

const KIND_LABEL: Record<PaymentProcessedKind, string> = {
  credit_repair: 'Credit repair',
  subscription: 'Marketing subscription',
  payment: 'Payment',
}

export function paidInvoiceAmountCents(invoice: Pick<Stripe.Invoice, 'amount_paid' | 'amount_due'>): number {
  if (invoice.amount_paid > 0) return invoice.amount_paid
  return invoice.amount_due > 0 ? invoice.amount_due : 0
}

export function buildPaymentProcessedAdminEmail(input: {
  clientName?: string | null
  clientEmail?: string | null
  clientId?: string | null
  amountCents: number
  kind: PaymentProcessedKind
  invoiceNumber?: string | null
  invoiceId?: string | null
  hostedInvoiceUrl?: string | null
  paidAtLabel?: string | null
}): { subject: string; html: string; to: string; adminPath: string } {
  const amount = formatRepairFeeCents(input.amountCents)
  const clientName = input.clientName?.trim() || 'Unknown client'
  const kindLabel = KIND_LABEL[input.kind]
  const subject = sanitizeEmailSubjectPart(`Payment received: ${amount} — ${clientName}`, 200)
  const adminPath = input.clientId?.trim()
    ? `/admin/clients?client=${encodeURIComponent(input.clientId.trim())}`
    : '/admin/billing'
  const paragraphs = [
    `${kindLabel} payment of ${amount} was processed.`,
    `Client: ${clientName}`,
    `Email: ${input.clientEmail?.trim() || 'not on file'}`,
    input.invoiceNumber ? `Invoice: ${input.invoiceNumber}` : null,
    input.invoiceId ? `Stripe invoice: ${input.invoiceId}` : null,
    input.paidAtLabel ? `Processed: ${input.paidAtLabel}` : null,
    input.hostedInvoiceUrl ? `Receipt: ${input.hostedInvoiceUrl}` : null,
  ].filter((line): line is string => Boolean(line))

  return {
    to: getAdminNotifyEmail(),
    subject,
    adminPath,
    html: staffPortalEmailHtml({
      heading: 'Payment received',
      bodyParagraphs: paragraphs,
      pathWithQuery: adminPath,
      buttonLabel: input.clientId ? 'Open client' : 'Open billing',
    }),
  }
}

function paidAtLabel(invoice: Stripe.Invoice): string | null {
  const paidAtRaw = invoice.status_transitions?.paid_at
  if (typeof paidAtRaw !== 'number' || Number.isNaN(paidAtRaw)) return null
  return (
    new Date(paidAtRaw * 1000).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    }) + ' ET'
  )
}

/** Staff inbox copy after Stripe reports an invoice as paid. Keep this off client bundles. */
export async function sendPaymentProcessedAdminEmail(input: {
  invoice: Stripe.Invoice
  client?: { id?: string | null; name?: string | null; email?: string | null } | null
  kind: PaymentProcessedKind
}): Promise<{ sent: boolean; reason?: string }> {
  const amountCents = paidInvoiceAmountCents(input.invoice)
  if (amountCents < 1) {
    return { sent: false, reason: 'Invoice has no paid amount.' }
  }
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'SMTP is not configured, so the payment confirmation could not be sent.' }
  }
  const copy = buildPaymentProcessedAdminEmail({
    clientName: input.client?.name,
    clientEmail: input.client?.email,
    clientId: input.client?.id,
    amountCents,
    kind: input.kind,
    invoiceNumber: input.invoice.number,
    invoiceId: input.invoice.id,
    hostedInvoiceUrl: input.invoice.hosted_invoice_url,
    paidAtLabel: paidAtLabel(input.invoice),
  })
  await sendEmail({ to: copy.to, subject: copy.subject, html: copy.html })
  return { sent: true }
}
