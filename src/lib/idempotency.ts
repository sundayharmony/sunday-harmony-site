/**
 * Short-lived idempotency cache for POST retries (in-memory + optional Upstash).
 */

type Cached = { body: unknown; status: number; expiresAt: number }

const memory = new Map<string, Cached>()

function pruneMemory() {
  const now = Date.now()
  for (const [k, v] of memory) {
    if (v.expiresAt <= now) memory.delete(k)
  }
}

async function upstashGet(key: string): Promise<Cached | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result?: string | null }
    if (!data.result) return null
    return JSON.parse(data.result) as Cached
  } catch {
    return null
  }
}

async function upstashSet(key: string, value: Cached, ttlSec: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}?EX=${ttlSec}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* best effort */
  }
}

export async function getIdempotentResponse(
  scope: string,
  key: string
): Promise<{ body: unknown; status: number } | null> {
  const fullKey = `idem:${scope}:${key}`
  const fromRedis = await upstashGet(fullKey)
  if (fromRedis && fromRedis.expiresAt > Date.now()) {
    return { body: fromRedis.body, status: fromRedis.status }
  }
  pruneMemory()
  const cached = memory.get(fullKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { body: cached.body, status: cached.status }
  }
  return null
}

export async function setIdempotentResponse(
  scope: string,
  key: string,
  body: unknown,
  status: number,
  ttlMs = 24 * 60 * 60 * 1000
): Promise<void> {
  const fullKey = `idem:${scope}:${key}`
  const entry: Cached = { body, status, expiresAt: Date.now() + ttlMs }
  memory.set(fullKey, entry)
  await upstashSet(fullKey, entry, Math.ceil(ttlMs / 1000))
}
