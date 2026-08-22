const API_BASE = () => {
  const url = process.env.DISPUTE_LETTERS_API_URL?.trim()
  if (!url) throw new Error('DISPUTE_LETTERS_API_URL not configured')
  return url.replace(/\/$/, '')
}

const API_SECRET = () => {
  const secret = process.env.DISPUTE_LETTERS_API_SECRET?.trim()
  if (!secret) throw new Error('DISPUTE_LETTERS_API_SECRET not configured')
  return secret
}

export function isDisputeLettersApiConfigured(): boolean {
  return Boolean(process.env.DISPUTE_LETTERS_API_URL?.trim() && process.env.DISPUTE_LETTERS_API_SECRET?.trim())
}

/** Normalize upstream (e.g. Railway) error bodies into a staff-facing message. */
export function friendlyDisputeLettersUpstreamError(raw: string, status: number): string {
  const text = (raw || '').trim()
  const tryParse = (value: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }

  const outer = tryParse(text)
  const nestedRaw = typeof outer?.error === 'string' ? outer.error : text
  const nested = tryParse(nestedRaw) || outer

  const message =
    (typeof nested?.message === 'string' && nested.message) ||
    (typeof nested?.error === 'string' && nested.error) ||
    ''

  if (
    status === 404 ||
    /application not found/i.test(message) ||
    /application not found/i.test(text)
  ) {
    return (
      'Credit Intelligence analysis service is unavailable (backend returned 404 Application not found). ' +
      'Redeploy services/dispute-letters-api on Railway and confirm Vercel DISPUTE_LETTERS_API_URL points to that service.'
    )
  }

  if (message) return message.slice(0, 300)
  if (text) return text.slice(0, 300)
  return `Analysis service request failed (${status || 'unknown'})`
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${API_SECRET()}`,
    'Content-Type': 'application/json',
  }
}

export async function disputeLettersFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE()}${path}`
  const headers = { ...authHeaders(), ...(init?.headers || {}) }
  return fetch(url, { ...init, headers })
}

export async function disputeLettersJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await disputeLettersFetch(path, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(friendlyDisputeLettersUpstreamError(text || '', res.status))
  }
  return res.json() as Promise<T>
}

/** Proxy an SSE stream from the Python API to the client response. */
export async function proxyDisputeLettersStream(
  path: string,
  body?: unknown
): Promise<Response> {
  const res = await disputeLettersFetch(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      Accept: 'text/event-stream',
    },
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    return new Response(
      JSON.stringify({ error: friendlyDisputeLettersUpstreamError(text, res.status || 502) }),
      {
        status: res.status || 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

export async function fetchDisputeLettersConfig(): Promise<{ cursor_api_configured: boolean }> {
  if (!isDisputeLettersApiConfigured()) {
    return { cursor_api_configured: false }
  }
  try {
    return await disputeLettersJson('/config')
  } catch {
    return { cursor_api_configured: false }
  }
}

export async function checkDisputeLettersHealth(): Promise<boolean> {
  if (!process.env.DISPUTE_LETTERS_API_URL?.trim()) return false
  try {
    const res = await fetch(`${API_BASE()}/health`, { cache: 'no-store' })
    if (!res.ok) return false
    const data = (await res.json()) as { status?: string }
    return data.status === 'ok'
  } catch {
    return false
  }
}
