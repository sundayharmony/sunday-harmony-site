import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { hasHoneypotValue } from '@/lib/honeypot'
import { parsePartnerSignup } from '@/lib/partner-signup'
import { createPartnerAccount } from '@/lib/partner-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const limited = await rateLimitDurable(`partner-signup:${ip}`, 8, 60 * 60 * 1000)
    if (!limited.allowed) return rateLimitResponse(limited.resetIn)

    const body = await req.json().catch(() => ({}))
    if (hasHoneypotValue(body)) {
      return NextResponse.json({ error: 'Unable to process submission' }, { status: 400 })
    }

    const parsed = parsePartnerSignup(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const created = await createPartnerAccount(parsed.value)
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: created.status })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    logApiRouteError(req, 'partners/signup', error)
    return NextResponse.json({ error: 'Unable to create a partner account.' }, { status: 500 })
  }
}
