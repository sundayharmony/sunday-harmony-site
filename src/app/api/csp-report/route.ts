import { NextRequest, NextResponse } from 'next/server'
import { readCspReport } from '@/lib/csp-report'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Receives CSP violation reports from Content-Security-Policy-Report-Only (and future enforce). */
export async function POST(request: NextRequest) {
  const body = await readCspReport(request)
  if (body) {
    console.warn('[CSP report]', JSON.stringify(body))
  }
  return new NextResponse(null, { status: 204 })
}
