import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { normalizeReferralCode, safeReferralLandingPath } from '@/lib/referrals'
import { trackReferralClick } from '@/lib/referral-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function limited(req: NextRequest) {
  const rl = await rateLimitDurable(`referral-track:${getClientIp(req)}`, 60, 60 * 60 * 1000)
  if (!rl.allowed) return rateLimitResponse(rl.resetIn)
  return null
}

export async function GET(req: NextRequest) {
  try {
    const blocked = await limited(req)
    if (blocked) return blocked

    const code = normalizeReferralCode(req.nextUrl.searchParams.get('code') || req.nextUrl.searchParams.get('ref'))
    const nextPath = safeReferralLandingPath(req.nextUrl.searchParams.get('next') || '/credit-funding')
    const res = NextResponse.redirect(new URL(nextPath, req.url))
    if (!code) return res
    await trackReferralClick(req, res, code, nextPath)
    return res
  } catch (error) {
    logApiRouteError(req, 'referrals/track', error)
    return NextResponse.redirect(new URL('/credit-funding', req.url))
  }
}

export async function POST(req: NextRequest) {
  try {
    const blocked = await limited(req)
    if (blocked) return blocked

    const body = await req.json().catch(() => ({}))
    const res = NextResponse.json({ ok: true })
    const result = await trackReferralClick(
      req,
      res,
      typeof body.code === 'string' ? body.code : null,
      '/credit-funding'
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return res
  } catch (error) {
    logApiRouteError(req, 'referrals/track', error)
    return NextResponse.json({ error: 'Unable to record referral.' }, { status: 500 })
  }
}
