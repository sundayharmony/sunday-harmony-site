import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import { resolveClientFileStoragePathForClient } from '../client-files-storage'
import {
  createStagedFileMetadataToken,
  verifyStagedFileMetadataToken,
  type TrustedStagedFileMetadata,
} from '../credit-funding-upload-session'
import {
  isExpiredStagedStorageObject,
  isStagedPathForSession,
} from '../credit-funding-storage'
import { scanDisputeFileBuffer } from '../dispute-letters-storage'
import { hasSafeStoragePathSegments, scanPdfBuffer } from '../storage-utils'

const originalSigningSecret = process.env.CREDIT_FUNDING_SIGNING_SECRET

before(() => {
  process.env.CREDIT_FUNDING_SIGNING_SECRET = 'area-09-test-signing-secret'
})

after(() => {
  if (originalSigningSecret === undefined) {
    delete process.env.CREDIT_FUNDING_SIGNING_SECRET
  } else {
    process.env.CREDIT_FUNDING_SIGNING_SECRET = originalSigningSecret
  }
})

describe('Area 09 upload hardening', () => {
  it('accepts only client-owned vault paths', () => {
    const clientId = '123e4567-e89b-42d3-a456-426614174000'
    const otherClientId = '223e4567-e89b-42d3-a456-426614174000'
    const fileId = '323e4567-e89b-42d3-a456-426614174000'

    assert.equal(
      resolveClientFileStoragePathForClient(`${clientId}/${fileId}_report.pdf`, clientId),
      `${clientId}/${fileId}_report.pdf`
    )
    assert.equal(
      resolveClientFileStoragePathForClient(`${otherClientId}/${fileId}_report.pdf`, clientId),
      null
    )
  })

  it('rejects traversal in staged paths even when metadata is signed', () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174000'
    const metadata: TrustedStagedFileMetadata = {
      documentType: 'photo_id',
      storagePath: `staging/${sessionId}/photo_id/../../other/report.pdf`,
      file_name: 'report.pdf',
      file_size: 100,
      file_type: 'pdf',
      mime_type: 'application/pdf',
      scan_status: 'clean',
    }

    const token = createStagedFileMetadataToken(sessionId, metadata)
    assert.equal(verifyStagedFileMetadataToken(sessionId, token), null)
    assert.equal(isStagedPathForSession(metadata.storagePath, sessionId), false)
    assert.equal(hasSafeStoragePathSegments(metadata.storagePath), false)
  })

  it('marks only timestamped objects older than the cutoff as expired', () => {
    const cutoff = Date.parse('2026-07-15T12:00:00.000Z')
    assert.equal(
      isExpiredStagedStorageObject({ created_at: '2026-07-15T11:59:59.000Z' }, cutoff),
      true
    )
    assert.equal(
      isExpiredStagedStorageObject({ created_at: '2026-07-15T12:00:01.000Z' }, cutoff),
      false
    )
    assert.equal(isExpiredStagedStorageObject({}, cutoff), false)
  })

  it('requires PDF magic bytes before publication', () => {
    assert.equal(scanPdfBuffer(Buffer.from('%PDF-1.7\nsafe')).ok, true)
    assert.equal(scanPdfBuffer(Buffer.from('not a pdf')).ok, false)
  })

  it('checks Word container signatures before dispute analysis', () => {
    const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])
    const fakeDocx = Buffer.from('plain text renamed to docx')
    assert.equal(
      scanDisputeFileBuffer(
        docx,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ).ok,
      true
    )
    assert.equal(
      scanDisputeFileBuffer(
        fakeDocx,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ).ok,
      false
    )
  })

  it('keeps staging cleanup secret-gated and scheduled', () => {
    const route = readFileSync(
      'src/app/api/internal/cleanup-credit-funding-staging/route.ts',
      'utf8'
    )
    const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      crons?: Array<{ path: string }>
    }
    assert.match(route, /Bearer \$\{cronSecret\}/)
    assert.equal(
      vercelConfig.crons?.some(
        (cron) => cron.path === '/api/internal/cleanup-credit-funding-staging'
      ),
      true
    )
  })
})
