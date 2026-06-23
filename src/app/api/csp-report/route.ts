import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Receives CSP violation reports from Content-Security-Policy-Report-Only (and future enforce). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (body) {
      console.warn('[CSP report]', JSON.stringify(body))
    }
  } catch {
    /* ignore malformed reports */
  }
  return new NextResponse(null, { status: 204 })
}
