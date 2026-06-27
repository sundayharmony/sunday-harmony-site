import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import {
  getCreditFundingApplicationByEmail,
  getCreditFundingApplicationByUserId,
} from '@/lib/credit-funding-db'
import type { CreditFundingApplication } from '@/lib/credit-funding-types'

export type ApplicantSessionResult =
  | { ok: true; session: Session; application: CreditFundingApplication }
  | { ok: false; response: NextResponse }

/** Authenticated applicant access to their own credit-funding application (not admin). */
export async function requireApplicantCreditFundingAccess(): Promise<ApplicantSessionResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (session.user.role === 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const userId = session.user.id
  const email = session.user.email.trim().toLowerCase()

  const byUser = await getCreditFundingApplicationByUserId(userId)
  const application = byUser || (await getCreditFundingApplicationByEmail(email))
  if (!application) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No application found' }, { status: 404 }),
    }
  }

  const emailMatch = application.email.trim().toLowerCase() === email
  const userMatch = Boolean(application.user_id && application.user_id === userId)
  if (!emailMatch && !userMatch) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, session, application }
}
