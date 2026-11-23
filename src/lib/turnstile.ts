/**
 * Cloudflare Turnstile verification for public, unauthenticated forms.
 *
 * Keys: NEXT_PUBLIC_TURNSTILE_SITE_KEY (browser widget) and TURNSTILE_SECRET_KEY (server).
 * When either key is unset, verification is skipped with a one-time warning so the
 * site still boots without secrets. Set both in production.
 */

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Form field / JSON key the browser sends the token in. */
export const TURNSTILE_TOKEN_FIELD = 'turnstileToken'

export type TurnstileAction = 'contact' | 'consultation' | 'credit_start' | 'credit_intake'

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: 'missing-token' | 'invalid-token' | 'action-mismatch' | 'unavailable'; codes?: string[] }

let warnedUnconfigured = false

export function isTurnstileConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim() && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())
}

/** Exposed for tests. */
export function resetTurnstileWarningForTests() {
  warnedUnconfigured = false
}

export function readTurnstileToken(input: FormData | Record<string, unknown> | null | undefined): string {
  if (!input) return ''
  const value = input instanceof FormData ? input.get(TURNSTILE_TOKEN_FIELD) : input[TURNSTILE_TOKEN_FIELD]
  return typeof value === 'string' ? value.trim() : ''
}

export async function verifyTurnstile(opts: {
  token: string
  action: TurnstileAction
  remoteIp?: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
}): Promise<TurnstileResult> {
  const env = opts.env ?? process.env
  if (!isTurnstileConfigured(env)) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true
      console.warn(
        '[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY not set — bot checks on public forms are skipped.'
      )
    }
    return { ok: true, skipped: true }
  }

  const token = opts.token.trim()
  // Cloudflare tokens are at most 2048 characters.
  if (!token || token.length > 2048) return { ok: false, reason: 'missing-token' }

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY!.trim(), response: token })
  if (opts.remoteIp && opts.remoteIp !== 'unknown') body.set('remoteip', opts.remoteIp)

  const doFetch = opts.fetchImpl ?? fetch
  try {
    const res = await doFetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[turnstile] siteverify HTTP', res.status)
      return { ok: false, reason: 'unavailable' }
    }
    const data = (await res.json()) as { success?: boolean; action?: string; 'error-codes'?: string[] }
    if (!data.success) return { ok: false, reason: 'invalid-token', codes: data['error-codes'] ?? [] }
    if (data.action && data.action !== opts.action) return { ok: false, reason: 'action-mismatch' }
    return { ok: true, skipped: false }
  } catch (error) {
    console.error('[turnstile] siteverify failed:', error)
    return { ok: false, reason: 'unavailable' }
  }
}

/** Standard JSON error for a failed check. The client resets the widget and the user retries. */
export function turnstileFailureResponse(result: Extract<TurnstileResult, { ok: false }>): Response {
  const unavailable = result.reason === 'unavailable'
  return new Response(
    JSON.stringify({
      error: unavailable
        ? 'We could not run the security check. Please try again in a moment.'
        : 'Please complete the security check and try again.',
      code: 'turnstile_failed',
    }),
    { status: unavailable ? 503 : 403, headers: { 'Content-Type': 'application/json' } }
  )
}
