import { NextRequest, NextResponse } from 'next/server'
import { cancelConsultationByToken } from '@/lib/consultation-service'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = body && typeof body.token === 'string' ? body.token.trim() : ''
  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'Missing cancellation token' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const rl = await rateLimitDurable(`consultation-cancel:${ip}`, 10, 15 * 60 * 1000)
  if (!rl.allowed) return rateLimitResponse(rl.resetIn)

  const result = await cancelConsultationByToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })
  return NextResponse.json({ ok: true, already: Boolean(result.already) })
}
