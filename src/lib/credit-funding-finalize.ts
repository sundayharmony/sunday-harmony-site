import { logActivity, getUserByEmail, createNotification, getCreditManagers } from '@/lib/db'
import { upsertLeadFromCreditIntake, ensureClientFromCreditApplication } from '@/lib/crm-db'
import {
  ensurePortalUserForCreditApplication,
  sendCreditFundingSubmissionEmail,
  sendCreditFundingExpertNotificationEmail,
} from '@/lib/credit-funding-applicant-onboarding'
import { linkApplicationToUser } from '@/lib/credit-funding-db'
import type { CreditFundingApplication } from '@/lib/credit-funding-types'
import type { IntakeFormPayload } from '@/lib/credit-funding-validation'
import {
  getAdminNotifyEmail,
  sanitizeEmailSubjectPart,
  sendHtmlMailNonBlocking,
  staffPortalEmailHtml,
} from '@/lib/smtp-mail'

export type FinalizeSubmissionResult = {
  application: CreditFundingApplication
  portalSetupCode?: string
}

/**
 * Shared post-submit side effects for public intake and staff draft finalize:
 * activity log, CRM lead, client ensure, portal user, notifications, emails.
 */
export async function runCreditFundingSubmissionSideEffects(params: {
  application: CreditFundingApplication
  payload: IntakeFormPayload
  actorEmail?: string | null
  activityDetails?: string
}): Promise<FinalizeSubmissionResult> {
  const { application, payload } = params
  const existingUser = await getUserByEmail(payload.email)

  if (existingUser && !application.user_id) {
    await linkApplicationToUser(application.id, existingUser.id, existingUser.client_id || undefined)
  }

  logActivity({
    action: 'application_submitted',
    entity_type: 'credit_funding_application',
    entity_id: application.id,
    actor_email: params.actorEmail || payload.email,
    details:
      params.activityDetails ||
      `Credit & Funding intake submitted: ${application.application_id}`,
  })

  await upsertLeadFromCreditIntake({
    email: payload.email,
    fullName: payload.fullName,
    phone: payload.phone,
    businessName: payload.businessProfile.legalName || payload.businessName,
    creditGoals: payload.creditGoals,
    fundingUse: payload.fundingUse,
    applicationUuid: application.id,
    clientId: existingUser?.client_id || application.client_id || undefined,
  })

  const client = await ensureClientFromCreditApplication(application)
  const appWithClient = client ? { ...application, client_id: client.id } : application

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

  const creditExperts = await getCreditManagers()
  for (const expert of creditExperts) {
    try {
      await sendCreditFundingExpertNotificationEmail({
        to: expert.email,
        expertName: expert.name,
        applicantName: payload.fullName,
        applicantEmail: payload.email,
        applicantPhone: payload.phone,
        applicationId: application.application_id,
        fundingAmount: payload.fundingAmount,
        fundingUse: payload.fundingUse,
        creditProvider: payload.selectedCreditProvider,
      })
    } catch (err) {
      console.error(`Failed to send expert notification to ${expert.email}:`, err)
    }
  }

  return {
    application: appWithClient,
    portalSetupCode: portal?.setupCode,
  }
}
