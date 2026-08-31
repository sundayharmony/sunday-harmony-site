import { NextResponse } from 'next/server'
import { createAuthenticationChallenge } from '@/lib/webauthn'
import { getClientIp } from '@/lib/rate-limit'
import { rateLimitDurable } from '@/lib/rate-limit-durable'

export async function POST(request: Request) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const emailKey = body.email?.toLowerCase().trim()
  const rlKey = emailKey
    ? `webauthn-login:${emailKey}`
    : `webauthn-login:anon:${getClientIp(request)}`

  const rl = await rateLimitDurable(rlKey, 10, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }

  try {
    const { options, challengeId } = await createAuthenticationChallenge(emailKey)
    return NextResponse.json({ options, challengeId })
  } catch (e) {
    console.error('Passkey login options error:', e)
    return NextResponse.json({ error: 'Failed to create authentication challenge' }, { status: 500 })
  }
}
