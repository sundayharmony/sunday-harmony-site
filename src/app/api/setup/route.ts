import { NextRequest, NextResponse } from 'next/server'
import { seedAdmin } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

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
    const rl = rateLimit(`setup:${ip}`, 3, 15 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const setupToken = process.env.SETUP_TOKEN
    if (!setupToken) {
      return NextResponse.json(
        { error: 'Setup is disabled. Set SETUP_TOKEN environment variable to enable.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    if (!body.token || body.token !== setupToken) {
      return NextResponse.json(
        { error: 'Invalid setup token' },
        { status: 401 }
      )
    }

    await seedAdmin()

    // Only confirm success — never leak admin details
    return NextResponse.json({
      success: true,
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

// Bug fix: add try-catch around seedAdmin
