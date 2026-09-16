import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  billingModelForCreditApplication,
  billingRequiresActivation,
  formatRepairFeeCents,
  isCreditRepairBillingClient,
  isCreditRepairLeadType,
  parseRepairFeeToCents,
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
    assert.match(migration, /credit_repair_one_time/)
    assert.match(panel, /Charge card on file/)
    assert.match(cfPage, /CreditRepairBillingPanel/)
  })
})
