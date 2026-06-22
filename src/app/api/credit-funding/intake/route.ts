import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity, getUserByEmail, createNotification } from '@/lib/db'
import { upsertLeadFromCreditIntake, ensureClientFromCreditApplication } from '@/lib/crm-db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  sendHtmlMailNonBlocking,
  escHtml,
  sanitizeEmailSubjectPart,
  getAdminNotifyEmail,
  staffPortalEmailHtml,
} from '@/lib/smtp-mail'
import {
  parseIntakePayload,
  validateIntakePayload,
  assertHttpsSubmission,
} from '@/lib/credit-funding-validation'
import {
  createCreditFundingApplication,
  createUploadedDocument,
  linkApplicationToUser,
} from '@/lib/credit-funding-db'
import {
  finalizeStagedCreditFundingDocument,
  isStagedPathForSession,
  isValidUploadSessionId,
  removeStagedCreditFundingSession,
  type StagedCreditFundingFile,
  uploadCreditFundingDocument,
} from '@/lib/credit-funding-storage'
import { BUSINESS_DOCUMENT_TYPES, type DocumentType } from '@/lib/credit-funding-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REQUIRED_DOCS: DocumentType[] = ['photo_id', 'proof_of_address', 'mail_proof']
const OPTIONAL_DOCS: DocumentType[] = ['selfie_with_id']
const ALL_DOC_TYPES = [...REQUIRED_DOCS, ...OPTIONAL_DOCS, ...BUSINESS_DOCUMENT_TYPES]

const DOC_FIELD_MAP: Partial<Record<DocumentType, string>> = {
  photo_id: 'photoId',
  proof_of_address: 'proofOfAddress',
  selfie_with_id: 'selfieWithId',
  mail_proof: 'mailProof',
}

export async function POST(req: NextRequest) {
  try {
    if (!assertHttpsSubmission(req)) {
      return NextResponse.json({ error: 'HTTPS is required' }, { status: 403 })
    }

    const ip = getClientIp(req)
    const rl = rateLimit(`credit-funding:${ip}`, 3, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    const formData = await req.formData()

    const rawPayload: Record<string, unknown> = {}
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') rawPayload[key] = value
    }

    const payload = parseIntakePayload(rawPayload)
    const validationError = validateIntakePayload(payload)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const uploadSessionId = String(formData.get('uploadSessionId') || '').trim()
    let stagedFiles: StagedCreditFundingFile[] = []
    if (uploadSessionId) {
      if (!isValidUploadSessionId(uploadSessionId)) {
        return NextResponse.json({ error: 'Invalid upload session' }, { status: 400 })
      }
      try {
        stagedFiles = JSON.parse(String(formData.get('stagedFiles') || '[]')) as StagedCreditFundingFile[]
      } catch {
        return NextResponse.json({ error: 'Invalid staged file payload' }, { status: 400 })
      }
      if (!Array.isArray(stagedFiles)) {
        return NextResponse.json({ error: 'Invalid staged file payload' }, { status: 400 })
      }
      for (const docType of REQUIRED_DOCS) {
        if (!stagedFiles.some((f) => f.documentType === docType)) {
          const label = docType.replace(/_/g, ' ')
          return NextResponse.json({ error: `Required document missing: ${label}` }, { status: 400 })
        }
      }
      for (const staged of stagedFiles) {
        if (!isStagedPathForSession(staged.storagePath, uploadSessionId)) {
          return NextResponse.json({ error: 'Invalid staged file reference' }, { status: 400 })
        }
      }
    } else {
      for (const docType of REQUIRED_DOCS) {
        const fieldName = DOC_FIELD_MAP[docType] || docType
        const file = formData.get(fieldName)
        if (!(file instanceof File) || file.size === 0) {
          const label = docType.replace(/_/g, ' ')
          return NextResponse.json({ error: `Required document missing: ${label}` }, { status: 400 })
        }
      }
    }

    const existingUser = await getUserByEmail(payload.email)
    const application = await createCreditFundingApplication(payload, {
      userId: existingUser?.id,
      clientId: existingUser?.client_id || undefined,
    })
    if (!application) {
      return NextResponse.json({ error: 'Failed to save application. Please try again.' }, { status: 500 })
    }

    if (existingUser && !application.user_id) {
      await linkApplicationToUser(application.id, existingUser.id, existingUser.client_id || undefined)
    }

    if (uploadSessionId && stagedFiles.length > 0) {
      for (const staged of stagedFiles) {
        const finalized = await finalizeStagedCreditFundingDocument({
          applicationUuid: application.id,
          staged,
          sessionId: uploadSessionId,
        })
        if (!finalized.ok) {
          return NextResponse.json({ error: `${staged.documentType}: ${finalized.error}` }, { status: 400 })
        }
        await createUploadedDocument({
          application_uuid: application.id,
          document_type: staged.documentType,
          file_name: finalized.data.displayName,
          file_type: finalized.data.file_type,
          file_size: finalized.data.file_size,
          storage_path: finalized.data.storagePath,
          mime_type: finalized.data.mime_type,
          scan_status: finalized.data.scan_status,
        })
      }
    } else {
      for (const docType of ALL_DOC_TYPES) {
        const fieldName = DOC_FIELD_MAP[docType] || docType
        const file = formData.get(fieldName)
        if (!(file instanceof File) || file.size === 0) continue

        const buffer = Buffer.from(await file.arrayBuffer())
        const upload = await uploadCreditFundingDocument({
          applicationUuid: application.id,
          documentType: docType,
          buffer,
          contentType: file.type,
          originalFileName: file.name,
        })

        if (!upload.ok) {
          return NextResponse.json({ error: `${docType}: ${upload.error}` }, { status: 400 })
        }

        await createUploadedDocument({
          application_uuid: application.id,
          document_type: docType,
          file_name: upload.data.displayName,
          file_type: upload.data.file_type,
          file_size: upload.data.file_size,
          storage_path: upload.data.storagePath,
          mime_type: upload.data.mime_type,
          scan_status: upload.data.scan_status,
        })
      }
    }

    logActivity({
      action: 'application_submitted',
      entity_type: 'credit_funding_application',
      entity_id: application.id,
      actor_email: payload.email,
      details: `Credit & Funding intake submitted: ${application.application_id} (${payload.fullName})`,
    })

    await upsertLeadFromCreditIntake({
      email: payload.email,
      fullName: payload.fullName,
      phone: payload.phone,
      businessName: payload.businessProfile.legalName || payload.businessName,
      creditGoals: payload.creditGoals,
      fundingUse: payload.fundingUse,
      applicationUuid: application.id,
      clientId: existingUser?.client_id || undefined,
    })

    await ensureClientFromCreditApplication(application)

    if (existingUser) {
      await createNotification({
        user_id: existingUser.id,
        title: 'Application Received',
        message: `Your Credit & Funding application ${application.application_id} has been submitted.`,
        type: 'info',
        link: '/dashboard/credit-funding',
      })
    }

    sendHtmlMailNonBlocking({
      to: payload.email,
      subject: sanitizeEmailSubjectPart(`Application Received — ${application.application_id}`, 200),
      html: `
        <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#b8943f;border-bottom:2px solid #b8943f;padding-bottom:10px">
            Thank You, ${escHtml(payload.fullName.split(' ')[0] || 'Applicant')}
          </h2>
          <p style="color:#525252;line-height:1.6">
            We have received your Credit &amp; Funding application. Our team will review your submission and contact you within 1–2 business days.
          </p>
          <p style="padding:12px;background:#fafafa;border-radius:8px;font-size:14px;color:#0a0a0a">
            <strong>Application ID:</strong> ${escHtml(application.application_id)}
          </p>
          <p style="color:#525252;line-height:1.6;font-size:14px">
            Track your status anytime by logging into your
            <a href="${escHtml(process.env.NEXT_PUBLIC_SITE_URL || 'https://sundayharmony.com')}/dashboard/credit-funding" style="color:#b8943f">client portal</a>
            with this email address.
          </p>
          <p style="font-size:13px;color:#a3a3a3">
            If you did not submit this application, please contact us immediately at sales@sundayharmony.com.
          </p>
        </div>
      `,
      logLabel: 'credit-funding-confirmation',
    })

    sendHtmlMailNonBlocking({
      to: getAdminNotifyEmail(),
      subject: sanitizeEmailSubjectPart(`New Credit & Funding Application: ${application.application_id}`, 200),
      html: staffPortalEmailHtml({
        heading: 'New Credit & Funding Application',
        bodyParagraphs: [
          `Application ID: ${application.application_id}`,
          `Name: ${payload.fullName}`,
          `Email: ${payload.email}`,
          `Phone: ${payload.phone}`,
          `Provider: ${payload.selectedCreditProvider}`,
          `Funding: ${payload.fundingAmount} (${payload.fundingUse})`,
        ],
        pathWithQuery: `/admin/credit-funding?id=${application.id}`,
      }),
      logLabel: 'credit-funding-admin-alert',
    })

    return NextResponse.json({
      success: true,
      applicationId: application.application_id,
      message: 'Your application has been submitted successfully.',
    })
  } catch (error) {
    logApiRouteError(req, 'credit-funding/intake', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
