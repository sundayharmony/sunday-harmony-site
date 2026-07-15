import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import {
  getCreditFundingApplicationByEmail,
  getCreditFundingApplicationByUserId,
  linkApplicationToUser,
} from '@/lib/credit-funding-db'
import type { CreditFundingApplication } from '@/lib/credit-funding-types'
import { isStaffRole } from '@/lib/stripe-admin-auth'

export type ApplicantSessionResult =
  | { ok: true; session: Session; application: CreditFundingApplication }
  | { ok: false; response: NextResponse }

/** Authenticated applicant access to their own credit-funding application (not admin). */
export async function requireApplicantCreditFundingAccess(): Promise<ApplicantSessionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (isStaffRole(session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const userId = session.user.id
  const email = session.user.email.trim().toLowerCase()

  const byUser = await getCreditFundingApplicationByUserId(userId)
  if (byUser) return { ok: true, session, application: byUser }

  const application = await getCreditFundingApplicationByEmail(email)
  if (!application) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No application found' }, { status: 404 }),
    }
  }

  const emailMatch = application.email.trim().toLowerCase() === email
  if (!emailMatch || application.user_id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const linked = await linkApplicationToUser(
    application.id,
    userId,
    session.user.clientId || application.client_id || undefined
  )
  if (!linked) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Application account link changed; please try again.' },
        { status: 409 }
      ),
    }
  }

  return {
    ok: true,
    session,
    application: {
      ...application,
      user_id: userId,
      client_id: session.user.clientId || application.client_id,
    },
  }
}
