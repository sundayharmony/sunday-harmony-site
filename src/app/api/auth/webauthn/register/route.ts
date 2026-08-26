import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isStaffRole } from '@/lib/staff-roles'
import {
  createRegistrationChallenge,
  verifyRegistration,
} from '@/lib/webauthn'
import { rateLimitDurable } from '@/lib/rate-limit-durable'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Passkeys are only available for staff accounts' }, { status: 403 })
  }

  if (!session.user.mfaVerified) {
    return NextResponse.json({ error: 'Complete MFA verification first' }, { status: 403 })
  }

  const rl = await rateLimitDurable(`webauthn-register:${session.user.id}`, 10, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }

  try {
    const { options, challengeId } = await createRegistrationChallenge(
      session.user.id,
      session.user.email,
      session.user.name || session.user.email
    )

    return NextResponse.json({ options, challengeId })
  } catch (e) {
    console.error('Passkey registration options error:', e)
    return NextResponse.json({ error: 'Failed to create registration challenge' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Passkeys are only available for staff accounts' }, { status: 403 })
  }

  if (!session.user.mfaVerified) {
    return NextResponse.json({ error: 'Complete MFA verification first' }, { status: 403 })
  }

  const rl = await rateLimitDurable(`webauthn-register:${session.user.id}`, 10, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }

  let body: { response: unknown; friendlyName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.response) {
    return NextResponse.json({ error: 'Missing response' }, { status: 400 })
  }

  try {
    const result = await verifyRegistration(
      session.user.id,
      body.response as Parameters<typeof verifyRegistration>[1],
      body.friendlyName
    )

    if (!result.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      credential: {
        id: result.credential?.id,
        friendlyName: result.credential?.friendly_name,
        createdAt: result.credential?.created_at,
      },
    })
  } catch (e) {
    console.error('Passkey registration verify error:', e)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
