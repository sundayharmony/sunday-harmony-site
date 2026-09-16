import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BILLING_PACKAGE_KEYS,
  billingPackageLabel,
  billingPackagePriceLabel,
  CREDIT_REPAIR_PACKAGE,
  currentBillingPackage,
  isCreditRepairPackage,
  isMarketingPackage,
} from '../billing-packages'

describe('billing packages', () => {
  it('lists credit repair ahead of marketing tiers', () => {
    assert.equal(BILLING_PACKAGE_KEYS[0], CREDIT_REPAIR_PACKAGE)
    assert.equal(isCreditRepairPackage('credit_repair'), true)
    assert.equal(isMarketingPackage('spark'), true)
    assert.equal(isMarketingPackage('credit_repair'), false)
    assert.equal(billingPackageLabel('credit_repair'), 'Credit Repair')
    assert.equal(billingPackagePriceLabel('credit_repair'), 'one-time')
    assert.equal(billingPackageLabel('spark'), 'Spark')
  })

  it('uses billing_model as the source of truth after a package switch', () => {
    assert.equal(
      currentBillingPackage({ billing_model: 'credit_repair_one_time', package_tier: 'free' }),
      'credit_repair'
    )
    assert.equal(
      currentBillingPackage({
        billing_model: 'marketing_subscription',
        lead_type: 'credit_repair_lead',
        package_tier: 'spark',
      }),
      'spark'
    )
    assert.equal(currentBillingPackage({ lead_type: 'credit_repair_lead' }), 'credit_repair')
  })
})

describe('billing package switch wiring', () => {
  it('lets staff save credit repair or a marketing tier from the plan API', () => {
    const service = readFileSync('src/lib/billing-service.ts', 'utf8')
    const plan = readFileSync('src/app/api/admin/clients/plan/route.ts', 'utf8')
    const clients = readFileSync('src/app/api/admin/clients/route.ts', 'utf8')
    const panel = readFileSync('src/components/billing/BillingPanel.tsx', 'utf8')
    const repair = readFileSync('src/components/billing/CreditRepairBillingPanel.tsx', 'utf8')
    assert.match(service, /export async function adminSetClientToCreditRepair/)
    assert.match(service, /Switched from credit repair to/)
    assert.match(plan, /adminSetClientToCreditRepair/)
    assert.match(plan, /isCreditRepairPackage/)
    assert.match(clients, /credit_repair_one_time/)
    assert.match(panel, /AdminBillingPackagePicker/)
    assert.match(repair, /Switch to/)
  })
})
