import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { getCreditFundingApplicationById } from '@/lib/credit-funding-db'
import { verifyApplicationInviteToken } from '@/lib/credit-funding-invite'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = await rateLimitDurable(`credit-funding-invite:${ip}`, 30, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const token = new URL(req.url).searchParams.get('token')?.trim()
    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 })
    }

    const verified = verifyApplicationInviteToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 403 })
    }

    if (Date.now() > verified.expiresAtMs) {
      return NextResponse.json({ error: 'This invitation link has expired. Contact Sunday Harmony for a new link.' }, { status: 403 })
    }

    const app = await getCreditFundingApplicationById(verified.applicationId)
    if (!app || app.status !== 'invitation_pending') {
      return NextResponse.json({ error: 'This invitation link is no longer valid' }, { status: 403 })
    }

    if (app.invite_expires_at && new Date(app.invite_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This invitation link has expired. Contact Sunday Harmony for a new link.' }, { status: 403 })
    }

    const phone =
      app.phone && app.phone !== 'Pending' ? app.phone : undefined

    return NextResponse.json({
      fullName: app.full_name,
      email: app.email,
      phone,
      expiresAt: new Date(verified.expiresAtMs).toISOString(),
    })
  } catch (error) {
    logApiRouteError(req, 'credit-funding/invite GET', error)
    return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 })
  }
}
