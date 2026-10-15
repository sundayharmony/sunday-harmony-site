import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { isEmailConfigured, sanitizeEmailSubjectPart, sendEmail } from '@/lib/smtp-mail'
import { requireAdminSession } from '@/lib/stripe-admin-auth'
import { partnerSignupInviteEmailHtml } from '@/lib/partner-invite-email'
import { getAdminPartnerDetail, listPartnersForAdmin, setPartnerApproval } from '@/lib/partner-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  const id = req.nextUrl.searchParams.get('id')?.trim()
  if (id) {
    const detail = await getAdminPartnerDetail(id)
    if ('error' in detail) return NextResponse.json({ error: detail.error }, { status: detail.status })
    return NextResponse.json(detail)
  }
  const partners = await listPartnersForAdmin()
  return NextResponse.json({ partners })
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession()
  if (session instanceof NextResponse) return session
  let inviting = false
  try {
    const body = await req.json().catch(() => ({}))
    if (body.action === 'invite') {
      inviting = true
      const limited = await rateLimitDurable(`partner-invite:${getClientIp(req)}`, 30, 60 * 60 * 1000)
      if (!limited.allowed) return rateLimitResponse(limited.resetIn)
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const firstName = typeof body.firstName === 'string' ? body.firstName.trim().slice(0, 80) : ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
      }
      if (!isEmailConfigured()) {
        return NextResponse.json({ error: 'Email is not configured on this server.' }, { status: 503 })
      }
      const who = sanitizeEmailSubjectPart(firstName, 60)
      await sendEmail({
        to: email,
        subject: who ? `${who}, sign up as a Sunday Harmony partner` : 'Sign up as a Sunday Harmony partner',
        html: partnerSignupInviteEmailHtml({ firstName }),
      })
      return NextResponse.json({ ok: true })
    }
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const action = body.action === 'approve' || body.action === 'disable' ? body.action : null
    if (!id || !action) {
      return NextResponse.json({ error: 'Partner and action are required.' }, { status: 400 })
    }
    const result = await setPartnerApproval(id, action)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true, status: result.status })
  } catch (error) {
    logApiRouteError(req, 'admin/partners', error)
    return NextResponse.json(
      { error: inviting ? 'Unable to send the signup email.' : 'Unable to update the partner.' },
      { status: 500 }
    )
  }
}
