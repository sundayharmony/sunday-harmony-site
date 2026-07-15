import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { rateLimitDurable } from '../rate-limit-durable'

function withEnv<T>(env: NodeJS.ProcessEnv, fn: () => Promise<T>): Promise<T> {
  const previous = { ...process.env }
  Object.assign(process.env, env)
  return fn().finally(() => {
    process.env = previous
  })
}

describe('rateLimitDurable', () => {
  it('uses the in-memory fallback when Upstash is not configured', async () => {
    await withEnv(
      {
        NODE_ENV: 'test',
        UPSTASH_REDIS_REST_TOKEN: '',
        UPSTASH_REDIS_REST_URL: '',
      },
      async () => {
        const key = `test-missing-upstash-${Date.now()}-${Math.random()}`
        assert.equal((await rateLimitDurable(key, 1, 60_000)).allowed, true)
        assert.equal((await rateLimitDurable(key, 1, 60_000)).allowed, false)
      }
    )
  })

  it('falls back when the Upstash request fails', async () => {
    const originalFetch = global.fetch
    global.fetch = async () =>
      new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 })

    try {
      await withEnv(
        {
          NODE_ENV: 'test',
          UPSTASH_REDIS_REST_TOKEN: 'token',
          UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
        },
        async () => {
          const key = `test-failed-upstash-${Date.now()}-${Math.random()}`
          assert.equal((await rateLimitDurable(key, 1, 60_000)).allowed, true)
          assert.equal((await rateLimitDurable(key, 1, 60_000)).allowed, false)
        }
      )
    } finally {
      global.fetch = originalFetch
    }
  })

  it('keeps sensitive routes off the bare in-memory limiter', () => {
    const sensitiveRoutes = [
      'src/app/api/dashboard/settings/route.ts',
      'src/app/api/setup/route.ts',
      'src/app/api/credit-funding/invite/route.ts',
      'src/app/api/csp-report/route.ts',
      'src/app/api/dashboard/credit-funding/upload/route.ts',
      'src/app/api/dashboard/messages/route.ts',
      'src/app/api/dashboard/credit-funding/messages/route.ts',
    ]

    for (const route of sensitiveRoutes) {
      const source = readFileSync(route, 'utf8')
      assert.doesNotMatch(
        source,
        /import\s+\{[^}]*\brateLimit\b[^}]*\}\s+from ['"]@\/lib\/rate-limit['"]/
      )
      assert.match(source, /rateLimitDurable/)
    }
  })
})
