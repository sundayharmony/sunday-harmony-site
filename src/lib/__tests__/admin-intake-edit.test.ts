import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('Admin intake edit on submitted applications', () => {
  it('exposes admin-only intake GET/PATCH and keeps staff draft path separate', () => {
    const intakeRoute = source('src/app/api/admin/credit-funding/[id]/intake/route.ts')
    const draftIdRoute = source('src/app/api/admin/credit-funding/drafts/[id]/route.ts')
    const db = source('src/lib/credit-funding-db.ts')
    const editor = source('src/components/credit-funding/StaffDraftEditor.tsx')
    const adminPage = source('src/app/admin/credit-funding/page.tsx')

    assert.match(intakeRoute, /requireAdminSession/)
    assert.doesNotMatch(intakeRoute, /requireCreditFundingStaffSession/)
    assert.match(intakeRoute, /updateSubmittedApplicationIntake/)
    assert.match(intakeRoute, /formatDraftForStaffEditor/)
    assert.match(intakeRoute, /mergeIntakePayloadWithExistingSecrets/)
    assert.match(intakeRoute, /Admin corrected intake fields/)
    assert.match(intakeRoute, /rateLimitDurable\(`cf-admin-intake-save/)
    assert.match(intakeRoute, /isUuid/)
    assert.doesNotMatch(intakeRoute, /decryptApplicationSensitiveFields/)

    assert.match(draftIdRoute, /Only open drafts can be edited/)
    assert.match(db, /export async function updateSubmittedApplicationIntake/)
    assert.match(db, /\.neq\('status', 'draft'\)/)

    assert.match(editor, /admin-intake/)
    assert.match(editor, /Save Intake Corrections/)
    assert.match(editor, /\/api\/admin\/credit-funding\/\$\{currentId\}\/intake/)

    assert.match(adminPage, /Edit intake/)
    assert.match(adminPage, /openAdminIntakeEditor/)
    assert.match(adminPage, /mode=\{draftEditorMode\}/)
    assert.match(adminPage, /setIsAdmin\(data\?\.user\?\.role === 'admin'\)/)
  })

  it('does not expose submitted intake edit to client dashboard APIs', () => {
    const clientApi = source('src/app/api/dashboard/credit-funding/route.ts')
    const clientPage = source('src/app/dashboard/credit-funding/page.tsx')
    assert.doesNotMatch(clientApi, /updateSubmittedApplicationIntake/)
    assert.doesNotMatch(clientPage, /Edit intake/)
    assert.doesNotMatch(clientPage, /StaffDraftEditor/)
  })
})
