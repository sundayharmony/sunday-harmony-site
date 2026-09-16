import { isEmailConfigured, sendEmail } from '@/lib/smtp-mail'
import { buildRepairInvoiceEmail } from '@/lib/credit-repair-billing'

/** Server-only. Do not import from client components — nodemailer cannot bundle for the browser. */
export async function sendRepairInvoiceEmail(input: {
  to?: string | null
  clientName: string
  amountCents: number
  paid: boolean
  hostedInvoiceUrl?: string | null
  invoiceNumber?: string | null
}): Promise<{ sent: boolean; reason?: string }> {
  const to = input.to?.trim()
  if (!to) return { sent: false, reason: 'Client email is missing.' }
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'SMTP is not configured, so the invoice email could not be sent.' }
  }
  const copy = buildRepairInvoiceEmail({
    clientName: input.clientName,
    amountCents: input.amountCents,
    paid: input.paid,
    hostedInvoiceUrl: input.hostedInvoiceUrl,
    invoiceNumber: input.invoiceNumber,
  })
  await sendEmail({ to, subject: copy.subject, html: copy.html })
  return { sent: true }
}
