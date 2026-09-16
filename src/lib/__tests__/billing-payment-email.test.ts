import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildPaymentProcessedAdminEmail,
  paidInvoiceAmountCents,
  sendPaymentProcessedAdminEmail,
} from '../billing-payment-email'

describe('staff payment confirmation email', () => {
  it('builds an admin payment-received email with client and invoice details', () => {
    const copy = buildPaymentProcessedAdminEmail({
      clientName: 'Charlie McNichol',
      clientEmail: 'maccesar.inc@gmail.com',
      clientId: 'client-1',
      amountCents: 25875,
      kind: 'credit_repair',
      invoiceNumber: 'ABC-1',
      invoiceId: 'in_123',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/paid',
      paidAtLabel: 'Sep 16, 2026, 2:40 PM ET',
    })
    assert.match(copy.subject, /Payment received: \$258\.75/)
    assert.match(copy.subject, /Charlie McNichol/)
    assert.equal(copy.adminPath, '/admin/clients?client=client-1')
    assert.match(copy.html, /Credit repair payment of \$258\.75/)
    assert.match(copy.html, /maccesar\.inc@gmail\.com/)
    assert.match(copy.html, /Invoice: ABC-1/)
    assert.match(copy.html, /https:\/\/invoice\.stripe\.com\/i\/paid/)
    assert.match(copy.html, /Open client/)
  })

  it('falls back to billing when the Stripe customer is not matched to a client', () => {
    const copy = buildPaymentProcessedAdminEmail({
      amountCents: 9900,
      kind: 'subscription',
    })
    assert.equal(copy.adminPath, '/admin/billing')
    assert.match(copy.html, /Marketing subscription/)
    assert.match(copy.html, /Unknown client/)
    assert.match(copy.html, /Open billing/)
  })

  it('skips $0 invoices and missing SMTP instead of emailing staff', async () => {
    assert.equal(paidInvoiceAmountCents({ amount_paid: 0, amount_due: 0 }), 0)
    assert.equal(paidInvoiceAmountCents({ amount_paid: 25875, amount_due: 0 }), 25875)
    const skipped = await sendPaymentProcessedAdminEmail({
      invoice: { amount_paid: 0, amount_due: 0, id: 'in_zero' } as never,
      kind: 'payment',
    })
    assert.equal(skipped.sent, false)
    assert.match(skipped.reason || '', /no paid amount/i)
  })
})

describe('staff payment confirmation wiring', () => {
  it('emails NOTIFY_EMAIL from invoice.paid without putting SMTP on client helpers', () => {
    const webhook = readFileSync('src/app/api/stripe/webhook/route.ts', 'utf8')
    const helpers = readFileSync('src/lib/credit-repair-billing.ts', 'utf8')
    assert.match(webhook, /sendPaymentProcessedAdminEmail/)
    assert.match(webhook, /SMTP admin payment confirmation on invoice.paid failed/)
    assert.doesNotMatch(helpers, /from ['"]@\/lib\/smtp-mail['"]|from ['"]@\/lib\/billing-payment-email['"]/)
  })
})
