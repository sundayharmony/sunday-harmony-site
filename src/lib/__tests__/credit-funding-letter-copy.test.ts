import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import {
  isLetterWorkingCopyPath,
  letterWorkingCopyFilePrefix,
  letterWorkingCopyOriginalId,
} from '../credit-funding-types'

const ORIGINAL_ID = '123e4567-e89b-42d3-a456-426614174000'

describe('letter working copy paths', () => {
  it('tags and parses the letter-use copy of a client original', () => {
    const prefix = letterWorkingCopyFilePrefix(ORIGINAL_ID)
    const storagePath = `app-uuid/photo_id/${prefix}aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee_clear.jpg`
    assert.equal(isLetterWorkingCopyPath(storagePath), true)
    assert.equal(isLetterWorkingCopyPath(`app-uuid/photo_id/${ORIGINAL_ID}_license.jpg`), false)
    assert.equal(letterWorkingCopyOriginalId(storagePath), ORIGINAL_ID)
  })
})

describe('credit funding letter copy wiring', () => {
  it('keeps the original upload and only staff can set the letter copy', () => {
    const db = readFileSync('src/lib/credit-funding-db.ts', 'utf8')
    const adminRoute = readFileSync('src/app/api/admin/credit-funding/documents/[id]/route.ts', 'utf8')
    const dashboardRoute = readFileSync('src/app/api/dashboard/credit-funding/documents/[id]/route.ts', 'utf8')
    const dashboardList = readFileSync('src/app/api/dashboard/credit-funding/route.ts', 'utf8')
    const adminPage = readFileSync('src/app/admin/credit-funding/page.tsx', 'utf8')
    const identity = readFileSync('src/lib/dispute-letters/letter-identity-attachments.ts', 'utf8')

    assert.match(db, /letterWorkingCopyFilePrefix/)
    assert.match(db, /createUploadedDocument/)
    assert.match(db, /shared_by: 'admin'/)
    assert.doesNotMatch(db, /deleteCreditFundingStoragePaths\(\[existing\.storage_path\]\)/)
    assert.match(adminRoute, /export async function PUT/)
    assert.match(adminRoute, /kept original/)
    assert.doesNotMatch(dashboardRoute, /export async function PUT/)
    assert.match(dashboardList, /isLetterWorkingCopyPath/)
    assert.match(adminPage, /Use for letters/)
    assert.match(adminPage, /Crop for letters/)
    assert.match(adminPage, /Original client upload/)
    assert.match(adminPage, /Used for letters/)
    assert.match(adminPage, /documentId=\{cropDoc\.id\}/)
    assert.match(identity, /resolveLetterIdentityDocs/)
    const content = readFileSync(
      'src/app/api/admin/credit-funding/documents/[id]/content/route.ts',
      'utf8'
    )
    assert.match(content, /downloadCreditFundingDocument/)
    assert.match(content, /requireCreditFundingStaffSession/)
  })

  it('blocks letter generation until ID, residence proof, and SSN card are on file', () => {
    const confirm = readFileSync('src/components/dispute-letters/DisputeConfirmStep.tsx', 'utf8')
    const panel = readFileSync('src/components/dispute-letters/LetterIdentityPrepPanel.tsx', 'utf8')
    const generate = readFileSync('src/app/api/admin/dispute-letters/[id]/generate/route.ts', 'utf8')
    const stream = readFileSync('src/app/api/admin/dispute-letters/[id]/generate/stream/route.ts', 'utf8')
    const types = readFileSync('src/lib/credit-funding-types.ts', 'utf8')
    assert.match(types, /ssn_card/)
    assert.match(confirm, /LetterIdentityPrepPanel/)
    assert.match(panel, /Email request/)
    assert.match(panel, /Crop for letters/)
    assert.match(panel, /Note for the client/)
    assert.match(generate, /findMissingLetterIdentityForApplication/)
    assert.match(stream, /findMissingLetterIdentityForApplication/)
  })
})
