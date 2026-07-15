import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { isStaffRole } from '@/lib/staff-roles'

/** Staff with completed password step who still need MFA verify or enrollment. */
export async function requireStaffMfaBootstrapSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Allow bootstrap while pending / enrollment; block only fully unverified strangers
  if (
    !session.user.mfaVerified &&
    !session.user.mfaPending &&
    !session.user.mfaEnrollmentRequired
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return session
}

/** Staff with full MFA (or clients never use this). */
export async function requireStaffMfaVerifiedSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!session.user.mfaVerified) {
    return NextResponse.json({ error: 'MFA required', code: 'MFA_REQUIRED' }, { status: 403 })
  }
  return session
}
