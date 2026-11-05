import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'
import { getPublicSiteUrl } from '@/lib/public-site-url'

function originOf(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function allowedOrigins(request: NextRequest): Set<string> {
  const allowed = new Set<string>([getPublicSiteUrl(), request.nextUrl.origin])
  const extra = process.env.NEXTAUTH_URL?.trim()
  if (extra) {
    try {
      allowed.add(new URL(extra).origin)
    } catch {
      /* ignore */
    }
  }
  return allowed
}

/** Cookie-authenticated mutating admin requests must be same-origin. */
export function isSameOriginRequest(request: NextRequest): boolean {
  const allowed = allowedOrigins(request)
  const origin = originOf(request.headers.get('origin'))
  if (origin) return allowed.has(origin)
  const referer = originOf(request.headers.get('referer'))
  if (referer) return allowed.has(referer)
  return false
}

export function verifyProviderWebhookSignature(input: {
  payload: string
  signature: string | null
  secret: string | null
}): boolean {
  if (!input.secret || !input.signature) return false
  const expected = createHmac('sha256', input.secret).update(input.payload).digest('hex')
  const actual = input.signature.replace(/^sha256=/i, '').trim()
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
