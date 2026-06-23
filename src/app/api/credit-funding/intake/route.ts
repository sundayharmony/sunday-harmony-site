import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { logActivity, getUserByEmail, createNotification } from '@/lib/db'
import { upsertLeadFromCreditIntake, ensureClientFromCreditApplication } from '@/lib/crm-db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  ensurePortalUserForCreditApplication,
  sendCreditFundingSubmissionEmail,
} from '@/lib/credit-funding-applicant-onboarding'
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
import { verifyUploadSession } from '@/lib/credit-funding-upload-session'
import { BUSINESS_DOCUMENT_TYPES, type DocumentType } from '@/lib/credit-funding-types'
import {
  getAdminNotifyEmail,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
  staffPortalEmailHtml,
} from '@/lib/smtp-mail'

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
    const uploadSessionToken = String(formData.get('uploadSessionToken') || '').trim()
    let stagedFiles: StagedCreditFundingFile[] = []
    if (uploadSessionId) {
      if (!isValidUploadSessionId(uploadSessionId)) {
        return NextResponse.json({ error: 'Invalid upload session' }, { status: 400 })
      }
      if (!verifyUploadSession(uploadSessionId, uploadSessionToken)) {
        return NextResponse.json({ error: 'Invalid upload session' }, { status: 403 })
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

    if (uploadSessionId) {
      await removeStagedCreditFundingSession(uploadSessionId)
    }

    logActivity({
      action: 'application_submitted',
      entity_type: 'credit_funding_application',
      entity_id: application.id,
      actor_email: payload.email,
      details: `Credit & Funding intake submitted: ${application.application_id}`,
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

    const client = await ensureClientFromCreditApplication(application)
    const appWithClient = client
      ? { ...application, client_id: client.id }
      : application

    const portal = await ensurePortalUserForCreditApplication(appWithClient)
    const linkedUser = portal ? await getUserByEmail(payload.email) : existingUser

    if (linkedUser) {
      await createNotification({
        user_id: linkedUser.id,
        title: 'Application Received',
        message: `Your Credit & Funding application ${application.application_id} has been submitted.`,
        type: 'info',
        link: '/dashboard/credit-funding',
      })
    }

    try {
      await sendCreditFundingSubmissionEmail({
        to: payload.email,
        fullName: payload.fullName,
        applicationId: application.application_id,
        setupCode: portal?.setupCode,
      })
    } catch (err) {
      console.error('Failed to send credit funding confirmation email:', err)
    }

    sendHtmlMailNonBlocking({
      to: getAdminNotifyEmail(),
      subject: sanitizeEmailSubjectPart(`New Credit & Funding Application — ${payload.fullName}`, 200),
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
