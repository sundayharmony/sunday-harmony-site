import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCreditManagers } from '@/lib/db'
import { getCreditFundingApplications } from '@/lib/credit-funding-db'
import {
  sendCreditFundingSubmissionEmail,
  sendCreditFundingExpertNotificationEmail,
} from '@/lib/credit-funding-applicant-onboarding'
import { decryptFieldOrLegacy } from '@/lib/field-encryption'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'credit_manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const sendToClients = body.sendToClients !== false
    const sendToExperts = body.sendToExperts !== false

    const applications = await getCreditFundingApplications({ status: 'all' })
    const submittedApps = applications.filter(
      (app) => app.status !== 'invitation_pending'
    )

    const results = {
      clientEmailsSent: 0,
      clientEmailsFailed: 0,
      expertEmailsSent: 0,
      expertEmailsFailed: 0,
      applications: submittedApps.length,
    }

    if (sendToClients) {
      for (const app of submittedApps) {
        try {
          await sendCreditFundingSubmissionEmail({
            to: app.email,
            fullName: app.full_name,
            applicationId: app.application_id,
          })
          results.clientEmailsSent++
        } catch (err) {
          console.error(`Failed to send client email to ${app.email}:`, err)
          results.clientEmailsFailed++
        }
      }
    }

    if (sendToExperts) {
      const experts = await getCreditManagers()
      
      for (const app of submittedApps) {
        const phone = decryptFieldOrLegacy(app.phone)
        const fundingAmount = app.funding_amount || 'Not specified'
        const fundingUse = app.funding_use || 'Not specified'
        const creditProvider = app.selected_credit_provider || 'Not specified'

        for (const expert of experts) {
          try {
            await sendCreditFundingExpertNotificationEmail({
              to: expert.email,
              expertName: expert.name,
              applicantName: app.full_name,
              applicantEmail: app.email,
              applicantPhone: phone,
              applicationId: app.application_id,
              fundingAmount,
              fundingUse,
              creditProvider,
            })
            results.expertEmailsSent++
          } catch (err) {
            console.error(`Failed to send expert email to ${expert.email}:`, err)
            results.expertEmailsFailed++
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Notification emails sent',
      results,
    })
  } catch (error) {
    console.error('Send notifications error:', error)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
