import crypto from 'crypto'
import { createUser, getUserByEmail, updateUser } from '@/lib/db'
import { getSupabase } from '@/lib/supabase'
import { linkApplicationToUser } from '@/lib/credit-funding-db'
import type { CreditFundingApplication } from '@/lib/credit-funding-types'
import {
  clientDashboardAlertEmailHtml,
  escHtml,
  getPublicSiteUrl,
  isEmailConfigured,
  sanitizeEmailSubjectPart,
  sendEmail,
} from '@/lib/smtp-mail'
import { hashVerificationToken } from '@/lib/verification-token'

const SETUP_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function ensurePortalUserForCreditApplication(
  app: Pick<CreditFundingApplication, 'id' | 'email' | 'full_name' | 'client_id' | 'user_id'>,
  options?: { issueSetupCode?: boolean }
): Promise<{ userId: string; setupCode?: string; isNewUser: boolean } | null> {
  const email = app.email.trim().toLowerCase()
  let user = await getUserByEmail(email)
  let isNewUser = false
  let setupCode: string | undefined

  if (!user) {
    setupCode = crypto.randomInt(100000, 999999).toString()
    const tempPassword = `${crypto.randomBytes(12).toString('base64url')}A1!`
    const created = await createUser({
      email,
      password: tempPassword,
      name: app.full_name,
      role: 'client',
      client_id: app.client_id || undefined,
    })
    if (!created) return null
    user = created
    isNewUser = true
  } else if (app.client_id && !user.client_id) {
    await updateUser(user.id, { client_id: app.client_id })
  }

  if (setupCode || options?.issueSetupCode) {
    setupCode = setupCode || crypto.randomInt(100000, 999999).toString()
    await getSupabase()
      .from('users')
      .update({
        reset_token: hashVerificationToken(setupCode),
        reset_token_expires: new Date(Date.now() + SETUP_CODE_TTL_MS).toISOString(),
      })
      .eq('id', user.id)
  }

  if (!app.user_id) {
    await linkApplicationToUser(app.id, user.id, app.client_id || user.client_id || undefined)
  }

  return { userId: user.id, setupCode, isNewUser }
}

export async function sendCreditFundingApplicationInviteEmail(params: {
  to: string
  fullName: string
  inviteUrl: string
  personalMessage?: string
  staffName?: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.error('Credit funding invite email: SMTP not configured')
    return
  }

  const first = escHtml(params.fullName.split(' ')[0] || 'there')
  const messageBlock = params.personalMessage?.trim()
    ? `<div style="padding:12px;background:#f8f6f0;border-radius:8px;margin:16px 0;white-space:pre-wrap;color:#525252;font-size:14px;line-height:1.6">${escHtml(params.personalMessage.trim())}</div>`
    : ''

  await sendEmail({
    to: params.to,
    subject: sanitizeEmailSubjectPart('Complete Your Credit & Funding Application', 200),
    html: `
      <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#b8943f;border-bottom:2px solid #b8943f;padding-bottom:10px">
          Hi ${first},
        </h2>
        <p style="color:#525252;line-height:1.6">
          ${escHtml(params.staffName || 'The Sunday Harmony team')} invited you to complete your secure Credit &amp; Funding application online.
        </p>
        ${messageBlock}
        <p style="color:#525252;line-height:1.6;font-size:14px">
          Use the button below to open your personalized application form. The link expires in 30 days.
        </p>
        <p style="margin:24px 0">
          <a href="${escHtml(params.inviteUrl)}" style="display:inline-block;padding:12px 24px;background:#0a0a0a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
            Start Application
          </a>
        </p>
        <p style="font-size:12px;color:#888;line-height:1.5">
          If the button does not work, copy and paste this link into your browser:<br />
          <a href="${escHtml(params.inviteUrl)}" style="color:#b8943f;word-break:break-all">${escHtml(params.inviteUrl)}</a>
        </p>
      </div>
    `,
  })
}

export async function sendCreditFundingSubmissionEmail(params: {
  to: string
  fullName: string
  applicationId: string
  setupCode?: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.error('Credit funding confirmation: SMTP not configured')
    return
  }

  const site = getPublicSiteUrl()
  const first = escHtml(params.fullName.split(' ')[0] || 'Applicant')
  const resetUrl = `${site}/reset-password?email=${encodeURIComponent(params.to.trim().toLowerCase())}`

  const portalSetupBlock = params.setupCode
    ? `
      <p style="color:#525252;line-height:1.6;font-size:14px">
        <strong>Set up your client portal</strong> to track status, upload documents, and message our team:
      </p>
      <ol style="color:#525252;line-height:1.6;font-size:14px;padding-left:20px">
        <li>Open <a href="${escHtml(resetUrl)}" style="color:#b8943f">Set up your password</a></li>
        <li>Enter your email and this one-time code: <strong style="letter-spacing:2px">${escHtml(params.setupCode)}</strong></li>
        <li>Choose a password, then sign in at <a href="${escHtml(site)}/login" style="color:#b8943f">your dashboard</a></li>
      </ol>
      <p style="font-size:12px;color:#888">This code expires in 7 days.</p>
    `
    : `
      <p style="color:#525252;line-height:1.6;font-size:14px">
        Track your application in the
        <a href="${escHtml(site)}/dashboard/credit-funding" style="color:#b8943f">client portal</a>
        — sign in with the email you used on this application.
      </p>
    `

  await sendEmail({
    to: params.to,
    subject: sanitizeEmailSubjectPart('Application Received — Credit & Funding', 200),
    html: `
      <div style="font-family:'Montserrat','Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#b8943f;border-bottom:2px solid #b8943f;padding-bottom:10px">
          Thank You, ${first}
        </h2>
        <p style="color:#525252;line-height:1.6">
          We have received your Credit &amp; Funding application. Our team will review your submission and contact you within 1–2 business days.
        </p>
        <p style="padding:12px;background:#fafafa;border-radius:8px;font-size:14px;color:#0a0a0a">
          <strong>Application ID:</strong> ${escHtml(params.applicationId)}
        </p>
        ${portalSetupBlock}
        <p style="font-size:13px;color:#a3a3a3;margin-top:20px">
          If you did not submit this application, please contact us at sales@sundayharmony.com.
        </p>
      </div>
    `,
  })
}

const MAX_INLINE_EMAIL_IMAGE_BYTES = 1024 * 1024

export interface CreditFundingEmailAttachment {
  fileName: string
  mimeType: string
  buffer: Buffer
}

function buildEmailAttachmentPayload(files: CreditFundingEmailAttachment[]): {
  mailAttachments: Array<{ filename: string; content: Buffer; contentType?: string; cid?: string }>
  inlineImageCids: Array<{ cid: string; alt: string }>
  nonImageNames: string[]
} {
  const mailAttachments: Array<{ filename: string; content: Buffer; contentType?: string; cid?: string }> = []
  const inlineImageCids: Array<{ cid: string; alt: string }> = []
  const nonImageNames: string[] = []

  for (const file of files) {
    const isImage = file.mimeType.startsWith('image/')
    if (isImage && file.buffer.length <= MAX_INLINE_EMAIL_IMAGE_BYTES) {
      const cid = `img-${crypto.randomBytes(8).toString('hex')}@sundayharmony.com`
      mailAttachments.push({
        filename: file.fileName,
        content: file.buffer,
        contentType: file.mimeType,
        cid,
      })
      inlineImageCids.push({ cid, alt: file.fileName })
    } else {
      mailAttachments.push({
        filename: file.fileName,
        content: file.buffer,
        contentType: file.mimeType,
      })
      nonImageNames.push(file.fileName)
    }
  }

  return { mailAttachments, inlineImageCids, nonImageNames }
}

export async function sendCreditFundingStatusUpdateEmail(params: {
  to: string
  applicationId: string
  statusLabel: string
  statusNotes?: string
  attachmentNames?: string[]
  attachments?: CreditFundingEmailAttachment[]
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.error('Credit funding status email: SMTP not configured')
    return
  }

  const { mailAttachments, inlineImageCids, nonImageNames } = buildEmailAttachmentPayload(
    params.attachments || []
  )
  const namedAttachments = params.attachmentNames || []

  await sendEmail({
    to: params.to,
    subject: sanitizeEmailSubjectPart(`Application Update — ${params.statusLabel}`, 200),
    html: clientDashboardAlertEmailHtml({
      heading: 'Application Status Update',
      firstName: 'there',
      bodyParagraphs: [
        `Your Credit & Funding application ${params.applicationId} status is now: ${params.statusLabel}.`,
        ...(params.statusNotes ? [params.statusNotes] : []),
        ...(inlineImageCids.length > 0
          ? ['Your specialist shared the following document(s):']
          : []),
        ...(namedAttachments.length > 0 && inlineImageCids.length === 0
          ? [`Your specialist shared ${namedAttachments.length} document${namedAttachments.length !== 1 ? 's' : ''}: ${namedAttachments.join(', ')}. View and download them in your client portal.`]
          : []),
        ...(nonImageNames.length > 0
          ? [`Additional file${nonImageNames.length !== 1 ? 's' : ''} attached to this email: ${nonImageNames.join(', ')}.`]
          : []),
      ],
      inlineImageCids,
      dashboardPath: '/dashboard/credit-funding',
      buttonLabel: 'View Application Status',
    }),
    attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
  })
}

export async function sendCreditFundingWorkflowUpdateEmail(params: {
  to: string
  applicationId: string
  statusLabel: string
  statusNotes?: string
  attachmentNames?: string[]
  attachments?: CreditFundingEmailAttachment[]
}): Promise<void> {
  await sendCreditFundingStatusUpdateEmail(params)
}

export async function sendCreditFundingDocumentRequestEmail(params: {
  to: string
  applicationId: string
  label: string
  notes?: string
}): Promise<void> {
  if (!isEmailConfigured()) return

  await sendEmail({
    to: params.to,
    subject: sanitizeEmailSubjectPart(`Document Requested — ${params.label}`, 200),
    html: clientDashboardAlertEmailHtml({
      heading: 'Document Requested',
      firstName: 'there',
      bodyParagraphs: [
        `We need an additional document for application ${params.applicationId}: ${params.label}.`,
        ...(params.notes ? [params.notes] : []),
        'Please upload the file in your client portal.',
      ],
      dashboardPath: '/dashboard/credit-funding',
      buttonLabel: 'Upload Document',
    }),
  })
}

export async function sendCreditFundingAdminMessageEmail(params: {
  to: string
  applicationId: string
  text: string
}): Promise<void> {
  if (!isEmailConfigured()) return

  await sendEmail({
    to: params.to,
    subject: sanitizeEmailSubjectPart('Message from Sunday Harmony', 200),
    html: `
      <div style="font-family:'Montserrat',Arial,sans-serif;max-width:600px">
        <h2 style="color:#b8943f">New Message</h2>
        <p>Regarding application <strong>${escHtml(params.applicationId)}</strong>:</p>
        <div style="padding:12px;background:#f8f6f0;border-radius:8px;margin:12px 0;white-space:pre-wrap">${escHtml(params.text)}</div>
        <p><a href="${escHtml(getPublicSiteUrl())}/dashboard/credit-funding" style="color:#b8943f">Reply in your portal</a></p>
      </div>
    `,
  })
}
