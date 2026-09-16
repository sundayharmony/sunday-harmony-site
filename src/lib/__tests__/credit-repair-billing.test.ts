import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  billingModelForCreditApplication,
  billingRequiresActivation,
  buildRepairInvoiceEmail,
  formatRepairFeeCents,
  isCreditRepairBillingClient,
  isCreditRepairLeadType,
  parseRepairFeeToCents,
  repairInvoiceMetadata,
  resolveRepairCollectionMode,
  sendRepairInvoiceEmail,
  shouldEmailRepairReceiptOnPay,
} from '../credit-repair-billing'

describe('credit repair billing helpers', () => {
  it('classifies repair-only and repair+funding as one-time billing', () => {
    assert.equal(
      billingModelForCreditApplication({ lead_type: 'credit_repair_lead', service_type: 'credit_repair' }),
      'credit_repair_one_time'
    )
    assert.equal(
      billingModelForCreditApplication({
        lead_type: 'credit_repair_funding',
        service_type: 'credit_and_funding',
      }),
      'credit_repair_one_time'
    )
    assert.equal(
      billingModelForCreditApplication({
        lead_type: 'personal_funding_lead',
        service_type: 'personal_funding',
      }),
      'marketing_subscription'
    )
  })

  it('treats lead_type as repair even before billing_model is backfilled', () => {
    assert.equal(isCreditRepairLeadType('credit_repair_lead'), true)
    assert.equal(isCreditRepairBillingClient({ lead_type: 'credit_repair_lead' }), true)
    assert.equal(isCreditRepairBillingClient({ billing_model: 'marketing_subscription' }), false)
    assert.equal(billingRequiresActivation({ lead_type: 'credit_repair_lead' }), false)
    assert.equal(billingRequiresActivation({ billing_model: 'marketing_subscription' }), true)
  })

  it('parses staff-entered dollar amounts into cents', () => {
    assert.deepEqual(parseRepairFeeToCents('499'), { cents: 49900 })
    assert.deepEqual(parseRepairFeeToCents('$1,200.50'), { cents: 120050 })
    assert.deepEqual(parseRepairFeeToCents(99), { cents: 9900 })
    assert.equal('error' in parseRepairFeeToCents('0.50'), true)
    assert.equal('error' in parseRepairFeeToCents(''), true)
    assert.equal(formatRepairFeeCents(49900), '$499.00')
  })

  it('emails an invoice when no card is on file instead of charging', () => {
    assert.equal(resolveRepairCollectionMode({ hasCard: false }), 'send_invoice')
    assert.equal(resolveRepairCollectionMode({ hasCard: true, preferSendInvoice: true }), 'send_invoice')
    assert.equal(resolveRepairCollectionMode({ hasCard: true, preferSendInvoice: false }), 'charge_card')
  })

  it('builds a client invoice/receipt email with a pay or receipt link', () => {
    const unpaid = buildRepairInvoiceEmail({
      clientName: 'Charlie McNichol',
      amountCents: 25875,
      paid: false,
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
      invoiceNumber: 'ABC-1',
    })
    assert.match(unpaid.subject, /Invoice: \$258\.75/)
    assert.match(unpaid.html, /Pay invoice/)
    assert.match(unpaid.html, /https:\/\/invoice\.stripe\.com\/i\/test/)

    const paid = buildRepairInvoiceEmail({
      clientName: 'Charlie McNichol',
      amountCents: 25875,
      paid: true,
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/paid',
      invoiceNumber: 'ABC-1',
    })
    assert.match(paid.subject, /Receipt/)
    assert.match(paid.html, /View receipt/)
  })

  it('marks card-on-file charges so the webhook does not send a second receipt', () => {
    const chargeMeta = repairInvoiceMetadata({ clientId: 'c1', emailReceiptOnPay: false })
    const invoiceMeta = repairInvoiceMetadata({ clientId: 'c1', emailReceiptOnPay: true })
    assert.equal(chargeMeta.email_receipt_on_pay, 'false')
    assert.equal(invoiceMeta.email_receipt_on_pay, 'true')
    assert.equal(
      shouldEmailRepairReceiptOnPay({ metadata: chargeMeta } as never),
      false
    )
    assert.equal(
      shouldEmailRepairReceiptOnPay({ metadata: invoiceMeta } as never),
      true
    )
  })

  it('skips SMTP when the client has no email', async () => {
    const result = await sendRepairInvoiceEmail({
      to: '',
      clientName: 'Charlie',
      amountCents: 25875,
      paid: false,
    })
    assert.equal(result.sent, false)
    assert.match(result.reason || '', /email is missing/i)
  })
})

describe('credit repair billing wiring', () => {
  it('keeps repair fees off marketing subscriptions', () => {
    const service = readFileSync('src/lib/billing-service.ts', 'utf8')
    const webhook = readFileSync('src/app/api/stripe/webhook/route.ts', 'utf8')
    const migration = readFileSync('supabase-migration-037-credit-repair-billing.sql', 'utf8')
    const panel = readFileSync('src/components/billing/CreditRepairBillingPanel.tsx', 'utf8')
    const cfPage = readFileSync('src/app/admin/credit-funding/page.tsx', 'utf8')

    assert.match(service, /export async function adminChargeCreditRepairFee/)
    assert.match(service, /This client is billed as a one-time credit repair fee/)
    assert.match(webhook, /applyRepairInvoicePaid/)
    assert.match(webhook, /isRepairInvoice/)
    assert.match(webhook, /sendRepairInvoiceEmail/)
    assert.match(webhook, /shouldEmailRepairReceiptOnPay/)
    assert.match(migration, /credit_repair_one_time/)
    assert.match(panel, /Payment history/)
    assert.match(panel, /Resend invoice email/)
    assert.match(cfPage, /CreditRepairBillingPanel/)
    assert.match(service, /adminResendRepairInvoiceEmail/)
    assert.match(service, /syncStripeCustomerContact/)
    assert.match(service, /delivered\.emailError/)
    assert.doesNotMatch(
      service.slice(service.indexOf('async function deliverRepairInvoiceCopy')),
      /emailed = true/
    )
  })

  it('does not send both amount and quantity on repair invoice lines', () => {
    const service = readFileSync('src/lib/billing-service.ts', 'utf8')
    const addLines = service.slice(service.indexOf('invoices.addLines'))
    const block = addLines.slice(0, addLines.indexOf('finalizeInvoice'))
    assert.match(block, /amount: parsed\.cents/)
    assert.doesNotMatch(block, /quantity/)
    assert.match(service, /listRepairInvoicesForCustomer/)
    assert.match(service, /deliverRepairInvoiceCopy/)
    assert.match(service, /sendRepairInvoiceEmail/)
  })
})
