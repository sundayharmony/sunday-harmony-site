import { NextRequest, NextResponse } from 'next/server'
import { logApiRouteError } from '@/lib/api-route-log'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { assertHttpsSubmission } from '@/lib/credit-funding-validation'
import { createUploadSession } from '@/lib/credit-funding-upload-session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    if (!assertHttpsSubmission(req)) {
      return NextResponse.json({ error: 'HTTPS is required' }, { status: 403 })
    }

    const ip = getClientIp(req)
    const rl = rateLimit(`credit-funding-session:${ip}`, 20, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const session = createUploadSession()
    return NextResponse.json(session)
  } catch (error) {
    logApiRouteError(req, 'credit-funding/session', error)
    return NextResponse.json({ error: 'Failed to start upload session' }, { status: 500 })
  }
}
