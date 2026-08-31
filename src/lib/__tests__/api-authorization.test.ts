import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import {
  createStagedFileMetadataToken,
  parseTrustedStagedFileSubmission,
  type TrustedStagedFileMetadata,
} from '../credit-funding-upload-session'
import { isDocumentType } from '../credit-funding-types'

const originalSigningSecret = process.env.CREDIT_FUNDING_SIGNING_SECRET

before(() => {
  process.env.CREDIT_FUNDING_SIGNING_SECRET = 'area-06-test-signing-secret'
})

after(() => {
  if (originalSigningSecret === undefined) {
    delete process.env.CREDIT_FUNDING_SIGNING_SECRET
  } else {
    process.env.CREDIT_FUNDING_SIGNING_SECRET = originalSigningSecret
  }
})

describe('Area 06 API authorization hardening', () => {
  it('recognizes only supported applicant document types', () => {
    assert.equal(isDocumentType('photo_id'), true)
    assert.equal(isDocumentType('tax_returns'), true)
    assert.equal(isDocumentType('staff_shared'), false)
    assert.equal(isDocumentType('../other-application'), false)
    assert.equal(isDocumentType(null), false)
  })

  it('uses signed staged metadata instead of browser-supplied fields', () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174000'
    const metadata: TrustedStagedFileMetadata = {
      documentType: 'photo_id',
      storagePath: `staging/${sessionId}/photo_id/file_report.pdf`,
      file_name: 'report.pdf',
      file_size: 1024,
      file_type: 'pdf',
      mime_type: 'application/pdf',
      scan_status: 'clean',
    }
    const metadataToken = createStagedFileMetadataToken(sessionId, metadata)

    const trusted = parseTrustedStagedFileSubmission(
      sessionId,
      [
        {
          metadataToken,
          documentType: 'tax_returns',
          storagePath: 'staging/attacker/path',
          scan_status: 'rejected',
          file_size: 1,
        },
      ],
      12
    )

    assert.deepEqual(trusted, [metadata])
  })

  it('rejects tampered, cross-session, and excessive staged metadata', () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174000'
    const metadata: TrustedStagedFileMetadata = {
      documentType: 'mail_proof',
      storagePath: `staging/${sessionId}/mail_proof/file_mail.pdf`,
      file_name: 'mail.pdf',
      file_size: 2048,
      file_type: 'pdf',
      mime_type: 'application/pdf',
      scan_status: 'clean',
    }
    const token = createStagedFileMetadataToken(sessionId, metadata)
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`

    assert.equal(
      parseTrustedStagedFileSubmission(sessionId, [{ metadataToken: tampered }], 12),
      null
    )
    assert.equal(
      parseTrustedStagedFileSubmission(
        '223e4567-e89b-42d3-a456-426614174000',
        [{ metadataToken: token }],
        12
      ),
      null
    )
    assert.equal(
      parseTrustedStagedFileSubmission(
        sessionId,
        Array.from({ length: 13 }, () => ({ metadataToken: token })),
        12
      ),
      null
    )
  })

  it('keeps the bulk notification route behind the MFA-aware helper', () => {
    const source = readFileSync(
      'src/app/api/admin/credit-funding/send-notifications/route.ts',
      'utf8'
    )
    assert.match(source, /requireCreditFundingStaffSession/)
    assert.doesNotMatch(source, /getServerSession/)
  })

  it('keeps staff draft routes behind MFA-aware staff auth with durable rate limits', () => {
    const createRoute = readFileSync('src/app/api/admin/credit-funding/drafts/route.ts', 'utf8')
    const draftRoute = readFileSync('src/app/api/admin/credit-funding/drafts/[id]/route.ts', 'utf8')
    const docsRoute = readFileSync(
      'src/app/api/admin/credit-funding/drafts/[id]/documents/route.ts',
      'utf8'
    )

    for (const source of [createRoute, draftRoute, docsRoute]) {
      assert.match(source, /requireCreditFundingStaffSession/)
      assert.match(source, /rateLimitDurable/)
      assert.doesNotMatch(source, /getServerSession\(/)
    }

    assert.match(createRoute, /formatDraftForStaffEditor/)
    assert.match(draftRoute, /formatDraftForStaffEditor/)
    assert.doesNotMatch(createRoute, /decryptApplicationSensitiveFields/)
    assert.doesNotMatch(draftRoute, /decryptApplicationSensitiveFields/)
  })

  it('blocks staff applicant access and claims only unbound applications', () => {
    const accessSource = readFileSync(
      'src/lib/credit-funding-dashboard-auth.ts',
      'utf8'
    )
    const databaseSource = readFileSync('src/lib/credit-funding-db.ts', 'utf8')

    assert.match(accessSource, /isStaffRole\(session\.user\.role\)/)
    assert.match(accessSource, /linkApplicationToUser\(/)
    assert.match(databaseSource, /\.is\('user_id', null\)/)
  })

  it('does not auto-link anonymous intake to an existing portal user', () => {
    const intake = readFileSync('src/app/api/credit-funding/intake/route.ts', 'utf8')
    const onboarding = readFileSync(
      'src/lib/credit-funding-applicant-onboarding.ts',
      'utf8'
    )
    const finalize = readFileSync('src/lib/credit-funding-finalize.ts', 'utf8')
    const drafts = readFileSync(
      'src/app/api/admin/credit-funding/drafts/[id]/route.ts',
      'utf8'
    )

    assert.match(intake, /createCreditFundingApplication\(payload\)/)
    assert.doesNotMatch(intake, /createCreditFundingApplication\(payload,\s*\{/)
    assert.match(intake, /completeInvitedCreditFundingApplication\([\s\S]*userId: existingUser\?\.id/)
    assert.match(onboarding, /if \(!app\.user_id && isNewUser\)/)
    assert.match(onboarding, /app\.user_id === user\.id/)
    assert.doesNotMatch(finalize, /linkApplicationToUser/)
    assert.match(finalize, /portal\.isNewUser \|\| application\.user_id/)
    assert.match(drafts, /userId: existingUser\?\.id/)
  })

  it('keeps dashboard ID ownership checks while using shared client auth', () => {
    const files = readFileSync('src/app/api/dashboard/files/route.ts', 'utf8')
    const approvals = readFileSync('src/app/api/dashboard/approvals/route.ts', 'utf8')
    const notifications = readFileSync(
      'src/app/api/dashboard/notifications/route.ts',
      'utf8'
    )

    for (const source of [files, approvals, notifications]) {
      assert.match(source, /requireClientSession/)
      assert.doesNotMatch(source, /getServerSession/)
    }
    assert.match(files, /file\.client_id !== clientId/)
    assert.match(files, /uploadTask\.client_id !== clientId/)
    assert.match(approvals, /existing\.client_id !== clientId/)
    assert.match(notifications, /notification\.user_id !== userId/)
  })
})
