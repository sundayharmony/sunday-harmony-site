import { NextRequest, NextResponse } from 'next/server'
import { bookConsultation } from '@/lib/consultation-service'
import { hasHoneypotValue } from '@/lib/honeypot'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'

export const dynamic = 'force-dynamic'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (hasHoneypotValue(body as Record<string, unknown>)) {
    return NextResponse.json({ error: 'Unable to process submission' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const business = typeof body.business === 'string' ? body.business.trim() : ''
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const startsAt = typeof body.startsAt === 'string' ? body.startsAt.trim() : ''

  if (!name || name.length > 120) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  if (phone.length > 30) return NextResponse.json({ error: 'Phone number is too long' }, { status: 400 })
  if (!business || business.length > 200) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
  if (note.length > 2000) return NextResponse.json({ error: 'Note is too long' }, { status: 400 })
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) {
    return NextResponse.json({ error: 'Pick a time' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const rl = await rateLimitDurable(`consultation:${ip}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) return rateLimitResponse(rl.resetIn)

  const result = await bookConsultation({ name, email, phone, business, note, startsAt })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, whenLabel: result.whenLabel, emailed: result.emailed })
}
