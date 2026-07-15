import { NextRequest, NextResponse } from 'next/server'
import { readCspReport } from '@/lib/csp-report'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable } from '@/lib/rate-limit-durable'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Receives CSP violation reports from Content-Security-Policy-Report-Only (and future enforce). */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = await rateLimitDurable(`csp-report:${ip}`, 60, 5 * 60 * 1000)
  if (!rl.allowed) return new NextResponse(null, { status: 204 })

  const body = await readCspReport(request)
  if (body) {
    console.warn('[CSP report]', JSON.stringify(body))
  }
  return new NextResponse(null, { status: 204 })
}
