---
name: "Area 07 Fix Plan — Rate Limiting Durability"
overview: "Upstash Redis is configured in production, so the durable limiter is active on most sensitive routes. Remaining work: two routes still use the in-memory limiter, a few public/spammable endpoints have no rate limit at all, and the durable limiter silently fails open to memory when Redis errors."
todos:
  - id: memory-holdouts
    content: "Migrate settings password-change and setup routes from in-memory rateLimit to rateLimitDurable"
    status: completed
  - id: missing-coverage
    content: "Add rate limits to invite validation, CSP report, and dashboard message/upload routes"
    status: completed
  - id: fail-mode
    content: "Log loudly (once per instance) when the durable limiter degrades to memory in production"
    status: completed
  - id: tests
    content: "Add focused tests for limiter fallback behavior and route coverage"
    status: completed
isProject: false
---

# Area 07 — Deep dive + fix plan

**Status:** implemented and verified
**Priority:** P1
**Scope:** Rate limiting durability across `src/lib/rate-limit*.ts` and all API routes.

---

## Summary

The architecture is two-tier: `rateLimit` (in-memory `Map`, per-instance, resets on cold start) and `rateLimitDurable` (Upstash Redis REST pipeline `INCR`/`EXPIRE NX`/`TTL`, falling back to memory when unconfigured or on error).

**Production reality check:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` exist in the Vercel production environment, so login, MFA, password reset, forgot-password, contact, credit-funding intake/stage/session, and file-upload routes are genuinely durable today. This area is smaller than the backlog assumed.

## Findings

### 1. Two routes still use the in-memory limiter — Medium

- `src/app/api/dashboard/settings/route.ts` (PUT, password change): `rateLimit('settings-password:${ip}', 5, 15m)`. A password-guessing attacker gets a fresh budget on every serverless instance/cold start. This is the most security-relevant holdout because it verifies the current password.
- `src/app/api/setup/route.ts` (POST, admin seeding): `rateLimit('setup:${ip}', 3, 15m)`. Gated by `SETUP_TOKEN` so risk is low, but token guessing gets the same per-instance reset.

**Fix:** switch both to `rateLimitDurable` + `rateLimitResponse`.

### 2. Public endpoints with no rate limit — Medium/Low

- `src/app/api/credit-funding/invite/route.ts` (GET): public, validates HMAC invite tokens and returns applicant name/email/phone. Tokens are signed so brute-force is infeasible, but there is no cap on validation attempts (enumeration noise, log spam).
- `src/app/api/csp-report/route.ts` (POST): public, body capped at 32KB but unlimited request volume → log-spam vector.

**Fix:** `rateLimitDurable` per IP — invite ~30/15m, CSP report ~60/5m (drop silently over limit, still return 204 or 429).

### 3. Authenticated dashboard write routes without limits — Low

- `src/app/api/dashboard/credit-funding/upload/route.ts` — file upload with no rate limit (the sibling `dashboard/files` upload has 20/15m).
- `src/app/api/dashboard/messages/route.ts` and `src/app/api/dashboard/credit-funding/messages/route.ts` — message creation with no limit (spam to admin inbox/notifications).

**Fix:** add `rateLimitDurable` keyed by session user ID (upload ~20/15m to match files; messages ~30/15m).

### 4. Durable limiter fails open quietly — Low / design decision

When Upstash is unreachable or returns an error, `rateLimitDurable` falls back to the in-memory limiter. On serverless that is effectively fail-open for a distributed attacker. Fail-closed would turn a Redis outage into a login outage, which is worse for this site's traffic profile.

**Decision:** keep fail-open (memory fallback) but make degradation visible: the existing `console.warn` only fires when Upstash is *unconfigured*; add an error-path warning (throttled to once per instance) so Redis failures show up in Vercel logs.

### 5. Non-issues verified

- Stripe webhook: signature-verified + idempotent; no rate limit needed.
- `getClientIp` trusts `x-forwarded-for`, which Vercel sets platform-side; acceptable.
- Login/MFA keys are per-email (not per-IP), which resists distributed guessing against one account; per-IP+per-email double keys already exist on reset flows.

## Implementation Plan

1. **Migrate holdouts** — `dashboard/settings` PUT and `api/setup` POST to `rateLimitDurable` + `rateLimitResponse`.
2. **Add missing coverage** — invite GET, csp-report POST, dashboard credit-funding upload, both dashboard message POST routes.
3. **Degradation visibility** — extend `rate-limit-durable.ts` to warn (once per instance) when the Upstash call errors in production, distinct from the unconfigured warning.
4. **Tests** — unit tests for `rateLimitDurable` memory fallback behavior and a source-level check that no API route imports the bare `rateLimit` for sensitive flows.
5. Run `npm run typecheck` and focused tests; commit and push.

## Success Criteria

- [x] No security-sensitive route uses the in-memory limiter directly.
- [x] All public unauthenticated POST/GET abuse surfaces have durable rate limits.
- [x] Redis degradation is visible in production logs.
- [x] Focused tests pass; typecheck passes.

---

## Implementation Notes

- `dashboard/settings` password changes and token-gated setup now use `rateLimitDurable` with standard `Retry-After` responses.
- Public invite validation and CSP report intake now have per-IP durable limits. CSP report over-limit responses stay `204` to avoid noisy browser/reporting behavior.
- Dashboard message sends and credit-funding applicant document uploads now have per-user durable limits.
- `rateLimitDurable` still falls back to memory on missing/unavailable Upstash to preserve availability, but production now logs one warning per instance for missing config and one for failed Redis calls.
- The in-memory limiter cleanup timer is `unref`'d so focused tests and short-lived Node processes can exit cleanly.
- Focused Area 07 test: 3 passed. `npm run typecheck` and `npm run build` passed. Build retained pre-existing image/useMemo warnings in credit-funding UI files.
