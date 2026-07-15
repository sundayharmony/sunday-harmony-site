import { NextRequest, NextResponse } from 'next/server'
import { seedAdmin } from '@/lib/db'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable, rateLimitResponse } from '@/lib/rate-limit-durable'
import { timingSafeStringEqual } from '@/lib/timing-safe'

export const dynamic = 'force-dynamic'

// Setup route is now POST-only and gated behind SETUP_TOKEN env var.
// This prevents unauthorized users from triggering admin seeding or
// leaking admin account details.

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with a valid setup token.' },
    { status: 405 }
  )
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 attempts per 15 minutes per IP
    const ip = getClientIp(req)
    const rl = await rateLimitDurable(`setup:${ip}`, 3, 15 * 60 * 1000)
    if (!rl.allowed) return rateLimitResponse(rl.resetIn)

    const setupToken = process.env.SETUP_TOKEN
    if (!setupToken) {
      return NextResponse.json(
        { error: 'Setup is disabled. Set SETUP_TOKEN environment variable to enable.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    if (!timingSafeStringEqual(String(body.token || ''), setupToken)) {
      return NextResponse.json(
        { error: 'Invalid setup token' },
        { status: 401 }
      )
    }

    const result = await seedAdmin()
    if (!result.seeded) {
      const message =
        result.reason === 'already_seeded_this_process'
          ? 'Admin seed already processed in this runtime.'
          : 'Admin seed was skipped. Check server configuration.'

      return NextResponse.json(
        {
          success: false,
          seeded: false,
          reason: result.reason,
          message,
        },
        { status: result.reason === 'already_seeded_this_process' ? 200 : 409 }
      )
    }

    // Only confirm success — never leak admin details
    return NextResponse.json({
      success: true,
      seeded: true,
      message: 'Admin account has been seeded.',
    })
  } catch (error: unknown) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: 'Setup failed. Check server logs.' },
      { status: 500 }
    )
  }
}
