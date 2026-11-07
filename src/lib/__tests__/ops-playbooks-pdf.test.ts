import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildOpsPlaybooksPdf, listOpsPlaybookFiles, resolveOpsDir } from '../ops-playbooks-pdf'

describe('ops playbooks PDF (admin asset builder)', () => {
  it('resolves ops markdown directory', () => {
    assert.ok(resolveOpsDir())
    assert.ok(listOpsPlaybookFiles().length >= 3)
  })

  it('builds a PDF buffer starting with %PDF', async () => {
    const pdf = await buildOpsPlaybooksPdf()
    assert.ok(pdf.length > 500)
    assert.equal(pdf.subarray(0, 4).toString('utf8'), '%PDF')
  })

  it('route module requires admin session only', () => {
    const source = readFileSync('src/app/api/admin/ops-playbooks/pdf/route.ts', 'utf8')
    assert.match(source, /requireAdminSession/)
    assert.doesNotMatch(source, /requireCreditFundingStaffSession/)
    assert.doesNotMatch(source, /public\//)
  })

  it('auth matrix: admin gate rejects credit_manager / client / unauth at source level', () => {
    const auth = readFileSync('src/lib/stripe-admin-auth.ts', 'utf8')
    const route = readFileSync('src/app/api/admin/ops-playbooks/pdf/route.ts', 'utf8')
    assert.match(auth, /export async function requireAdminSession/)
    assert.match(auth, /role === 'admin'/)
    assert.match(route, /requireAdminSession/)
    // Training UI only shows download for admin role
    const training = readFileSync('src/app/admin/training/page.tsx', 'utf8')
    assert.match(training, /role === 'admin' && disputeOpsTraining\.staffPdfHref/)
  })
})
