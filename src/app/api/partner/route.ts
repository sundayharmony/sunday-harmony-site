import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { requirePartnerSession } from '@/lib/partner-auth'
import { parsePartnerPasswordChange, parsePartnerProfileUpdate } from '@/lib/partner-signup'
import { changePartnerPassword, getPartnerDashboard, updatePartnerAccount } from '@/lib/partner-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await requirePartnerSession()
  if (session instanceof NextResponse) return session
  try {
    const result = await getPartnerDashboard(session.user.id)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (error) {
    logApiRouteError(req, 'partner', error)
    return NextResponse.json({ error: 'Unable to load your partner dashboard.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requirePartnerSession()
  if (session instanceof NextResponse) return session
  const limited = await rateLimitDurable(`partner-account:${session.user.id}`, 20, 15 * 60 * 1000)
  if (!limited.allowed) return rateLimitResponse(limited.resetIn)

  try {
    const body = await req.json().catch(() => ({}))
    if (body.action === 'password') {
      const parsed = parsePartnerPasswordChange(body)
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
      const result = await changePartnerPassword(
        session.user.id,
        parsed.value.currentPassword,
        parsed.value.newPassword
      )
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ ok: true, signedOut: true })
    }

    if (body.action === 'profile') {
      const parsed = parsePartnerProfileUpdate(body)
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
      const result = await updatePartnerAccount(session.user.id, parsed.value)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      const dashboard = await getPartnerDashboard(session.user.id)
      if ('error' in dashboard) return NextResponse.json({ ok: true })
      return NextResponse.json({ ok: true, profile: dashboard.profile })
    }

    return NextResponse.json({ error: 'Unknown account action.' }, { status: 400 })
  } catch (error) {
    logApiRouteError(req, 'partner', error)
    return NextResponse.json({ error: 'Unable to update your account.' }, { status: 500 })
  }
}
