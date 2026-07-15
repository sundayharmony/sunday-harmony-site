/**
 * Optional durable rate limiting via Upstash Redis REST API.
 * Falls back to in-memory limiter when UPSTASH_REDIS_REST_URL / TOKEN are unset.
 */

import { rateLimit as memoryRateLimit } from '@/lib/rate-limit'

type RateLimitResult = { allowed: boolean; remaining: number; resetIn: number }
type UpstashRateLimitAttempt = {
  configured: boolean
  failed: boolean
  result: RateLimitResult | null
}

let warnedMissingUpstash = false
let warnedFailedUpstash = false

function warnProductionFallback(reason: 'missing' | 'failed', details?: string) {
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') return

  if (reason === 'missing') {
    if (warnedMissingUpstash) return
    warnedMissingUpstash = true
    console.warn(
      '[rate-limit] Upstash not configured — falling back to in-memory limits (unreliable on serverless). Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    )
    return
  }

  if (warnedFailedUpstash) return
  warnedFailedUpstash = true
  console.warn(
    `[rate-limit] Upstash rate limit request failed — falling back to in-memory limits (unreliable on serverless).${details ? ` ${details}` : ''}`
  )
}

async function upstashRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<UpstashRateLimitAttempt> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return { configured: false, failed: false, result: null }

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000))
  const key = `rl:${identifier}`

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSec, 'NX'],
        ['TTL', key],
      ]),
    })

    if (!res.ok) {
      return {
        configured: true,
        failed: true,
        result: null,
      }
    }

    const data = (await res.json()) as Array<{ result?: number }>
    const count = data[0]?.result ?? 1
    const ttlSec = data[2]?.result ?? windowSec
    const resetIn = Math.max(0, ttlSec * 1000)

    if (count > limit) {
      return {
        configured: true,
        failed: false,
        result: { allowed: false, remaining: 0, resetIn },
      }
    }

    return {
      configured: true,
      failed: false,
      result: { allowed: true, remaining: Math.max(0, limit - count), resetIn },
    }
  } catch (err) {
    console.error('Upstash rate limit error:', err)
    return {
      configured: true,
      failed: true,
      result: null,
    }
  }
}

export async function rateLimitDurable(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): Promise<RateLimitResult> {
  const durable = await upstashRateLimit(identifier, limit, windowMs)
  if (durable.result) return durable.result

  warnProductionFallback(durable.configured && durable.failed ? 'failed' : 'missing')

  return memoryRateLimit(identifier, limit, windowMs)
}

export function rateLimitResponse(resetIn: number): Response {
  return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(Math.ceil(resetIn / 1000)),
    },
  })
}
