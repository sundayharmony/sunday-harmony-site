import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import {
  buildIntakePdfModel,
  collectIntakePdfFiles,
  formatIntakePdfPreparedAt,
  intakePdfFilename,
  intakePdfSourceFromApplication,
  planIntakeAttachments,
  type IntakeAttachmentSource,
} from '../credit-funding-intake-pdf'
import { renderIntakePdf } from '../credit-funding-intake-pdf-server'

const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
)

function application() {
  return {
    application_id: 'CF-1042',
    full_name: 'Ada Client',
    email: 'ada@example.com',
    phone: '555-0100',
    address: '10 Main St',
    city: 'Brooklyn',
    state: 'NY',
    zip_code: '11201',
    date_of_birth: '1990-04-02',
    ssn: '123456789',
    status: 'submitted',
    created_at: '2026-03-15T16:30:00.000Z',
    selected_credit_provider: 'Experian',
    provider_username: 'ada-login',
    provider_password: 'Sup3rSecretPassword!',
    experian_email: 'ada.experian@example.com',
    experian_password: 'ExperianSecret!',
    experian_security_answer: 'SecurityAnswer!',
    experian_pin: '9876',
    cfpb_email: 'ada.cfpb@example.com',
    cfpb_password: 'CfpbSecret!',
    credit_goals: ['Build credit'],
    funding_goals: 'Working capital',
    primary_credit_goals_text: 'Raise my score',
    funding_amount: '$25,000',
    funding_use: 'Business',
    funding_timeframe: '30 Days',
    owns_business: true,
    business_name: 'Ada Studio',
    goals_notes: 'Need equipment',
    internal_notes: 'Staff only note about Ada',
    credit_profile: {
      creditScore: '680',
      openCreditCards: '2',
      inquiries: '1',
      monthlyGrossIncome: '4500',
      annualIncome: '54000',
      bankruptcy: false,
      collections: true,
      employed: true,
      businessOwner: true,
    },
    business_profile: {
      legalName: 'Ada Studio LLC',
      ein: '12-3456789',
      monthEstablished: '03',
      yearEstablished: '2020',
      city: 'Brooklyn',
      state: 'NY',
    },
    consent_data: { accurateInfo: true, authorizeReview: true, agreeTerms: true },
    typed_signature: 'Ada Client',
    signature_date: '2026-03-15',
  }
}

describe('credit funding intake PDF', () => {
  it('puts identity, income, business, and signature in the packet', () => {
    const model = buildIntakePdfModel(application(), undefined, new Date('2026-03-15T16:30:00.000Z'))
    assert.match(model.plainText, /Ada Client/)
    assert.match(model.plainText, /1990-04-02/)
    assert.match(model.plainText, /123-45-6789/)
    assert.match(model.plainText, /4500/)
    assert.match(model.plainText, /54000/)
    assert.match(model.plainText, /12-3456789/)
    assert.match(model.plainText, /March/)
    assert.match(model.plainText, /Ada Client/)
    assert.match(model.plainText, /Typed signature: Ada Client/)
    assert.match(model.plainText, /Submitted/)
    assert.match(model.filename, /^Intake-Ada-Client-CF-1042\.pdf$/)
    assert.match(model.preparedAt, /Mar 15, 2026/)
    assert.match(model.preparedAt, /12:30/)
    assert.match(model.preparedAt, /ET/)
  })

  it('leaves portal passwords, the security answer, and the PIN out of the packet', () => {
    const source = intakePdfSourceFromApplication(application())
    assert.equal('provider_password' in source, false)
    assert.equal('experian_password' in source, false)
    assert.equal('cfpb_password' in source, false)
    assert.equal('experian_pin' in source, false)
    assert.equal('experian_security_answer' in source, false)
    assert.equal('internal_notes' in source, false)

    const model = buildIntakePdfModel(application())
    assert.doesNotMatch(model.plainText, /Sup3rSecretPassword!/)
    assert.doesNotMatch(model.plainText, /ExperianSecret!/)
    assert.doesNotMatch(model.plainText, /SecurityAnswer!/)
    assert.doesNotMatch(model.plainText, /9876/)
    assert.doesNotMatch(model.plainText, /CfpbSecret!/)
    assert.doesNotMatch(model.plainText, /Staff only note/)
    assert.match(model.plainText, /ada-login/)
    assert.match(model.plainText, /ada\.experian@example\.com/)
    assert.match(model.plainText, /stay on the admin intake screen/)
  })

  it('sanitizes the download filename', () => {
    assert.equal(intakePdfFilename('Ada / Client', 'CF 1042'), 'Intake-Ada-Client-CF1042.pdf')
    assert.equal(formatIntakePdfPreparedAt(new Date('2026-01-15T17:00:00.000Z')).endsWith('ET'), true)
  })

  it('keeps client uploads and leaves specialist or rejected files in the portal', () => {
    const docs: IntakeAttachmentSource[] = [
      {
        id: 'bank',
        document_type: 'bank_statements',
        file_name: 'statements.pdf',
        mime_type: 'application/pdf',
        storage_path: 'app/bank_statements/statements.pdf',
        scan_status: 'clean',
        created_at: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'id',
        document_type: 'photo_id',
        file_name: 'license.jpg',
        mime_type: 'image/jpeg',
        storage_path: 'app/photo_id/license.jpg',
        scan_status: 'clean',
        created_at: '2026-03-02T00:00:00.000Z',
      },
      {
        id: 'staff',
        document_type: 'staff_shared',
        file_name: 'notes.pdf',
        mime_type: 'application/pdf',
        storage_path: 'app/staff_shared/notes.pdf',
        scan_status: 'clean',
        shared_by: 'admin',
      },
      {
        id: 'bad',
        document_type: 'mail_proof',
        file_name: 'bill.pdf',
        mime_type: 'application/pdf',
        storage_path: 'app/mail_proof/bill.pdf',
        scan_status: 'rejected',
      },
    ]
    const plan = planIntakeAttachments(docs)
    assert.deepEqual(
      plan.include.map((file) => file.id),
      ['id', 'bank']
    )
    assert.equal(plan.skipped.length, 2)
    assert.match(plan.skipped.map((file) => file.reason).join('\n'), /Specialist file/)
    assert.match(plan.skipped.map((file) => file.reason).join('\n'), /safety check/)
  })

  it('stops adding files once the packet reaches its size limit', async () => {
    const docs: IntakeAttachmentSource[] = [
      {
        id: 'a',
        document_type: 'photo_id',
        file_name: 'a.jpg',
        mime_type: 'image/jpeg',
        storage_path: 'app/photo_id/a.jpg',
        scan_status: 'clean',
      },
      {
        id: 'b',
        document_type: 'mail_proof',
        file_name: 'b.pdf',
        mime_type: 'application/pdf',
        storage_path: 'app/mail_proof/b.pdf',
        scan_status: 'clean',
      },
    ]
    const collected = await collectIntakePdfFiles(
      docs,
      async (path) => (path.endsWith('a.jpg') ? PNG : new Uint8Array(50)),
      PNG.byteLength
    )
    assert.equal(collected.files.length, 1)
    assert.equal(collected.files[0].id, 'a')
    assert.match(collected.skipped[0].reason, /so the PDF can be downloaded/)
  })

  it('embeds a photo and merges an uploaded PDF', async () => {
    const attachment = await PDFDocument.create()
    attachment.addPage([400, 500])
    const pdfBytes = await attachment.save()
    const model = buildIntakePdfModel(application(), {
      included: [
        { label: 'Government Photo ID', fileName: 'license.png' },
        { label: 'Mail Proof', fileName: 'bill.pdf' },
      ],
      skipped: [],
    })
    const bytes = await renderIntakePdf(model, [
      {
        id: 'png',
        label: 'Government Photo ID',
        fileName: 'license.png',
        storagePath: 'app/photo_id/license.png',
        mimeType: 'image/png',
        kind: 'png',
        bytes: PNG,
      },
      {
        id: 'pdf',
        label: 'Mail Proof',
        fileName: 'bill.pdf',
        storagePath: 'app/mail_proof/bill.pdf',
        mimeType: 'application/pdf',
        kind: 'pdf',
        bytes: pdfBytes,
      },
    ])
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-')
    const opened = await PDFDocument.load(bytes)
    assert.ok(opened.getPageCount() >= 3)
    const sizes = opened.getPages().map((page) => page.getSize())
    assert.ok(sizes.some((size) => size.width === 400 && size.height === 500))
  })

  it('still returns a PDF when an uploaded file cannot be read', async () => {
    const model = buildIntakePdfModel({ full_name: 'Ada Client', application_id: 'CF-1' })
    const bytes = await renderIntakePdf(model, [
      {
        id: 'bad',
        label: 'Government Photo ID',
        fileName: 'license.jpg',
        storagePath: 'app/photo_id/license.jpg',
        mimeType: 'image/jpeg',
        kind: 'jpeg',
        bytes: Uint8Array.from([1, 2, 3, 4]),
      },
    ])
    const opened = await PDFDocument.load(bytes)
    assert.ok(opened.getPageCount() >= 2)
  })

  it('gates the download route on credit funding staff and decrypts the intake', () => {
    const route = readFileSync('src/app/api/admin/credit-funding/[id]/intake-pdf/route.ts', 'utf8')
    const page = readFileSync('src/app/admin/credit-funding/page.tsx', 'utf8')
    const builder = readFileSync('src/lib/credit-funding-intake-pdf.ts', 'utf8')
    assert.match(route, /requireCreditFundingStaffSession/)
    assert.match(route, /decryptApplicationSensitiveFields/)
    assert.match(route, /intakePdfSourceFromApplication/)
    assert.doesNotMatch(route, /formatApplicationForAdmin/)
    assert.match(page, /Download intake PDF/)
    assert.match(page, /\/intake-pdf/)
    assert.doesNotMatch(
      builder,
      /provider_password|experian_password|cfpb_password|experian_security_answer|experian_pin/
    )
  })
})
