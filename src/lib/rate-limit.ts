// Simple in-memory rate limiter for API routes.
// Not durable across serverless instances or cold starts: each instance has its own Map.
// For production at scale (or strict abuse protection), use Upstash Redis, Vercel KV, or similar.

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key)
  })
}, 5 * 60 * 1000)
cleanupTimer.unref?.()

export function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || entry.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetIn: windowMs }
  }

  entry.count++

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  return { allowed: true, remaining: limit - entry.count, resetIn: entry.resetAt - now }
}

/**
 * Client IP for rate limiting. Prefer the rightmost X-Forwarded-For hop — that
 * value is appended by the trusted edge (Vercel). The leftmost address can be
 * spoofed by the client.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}
