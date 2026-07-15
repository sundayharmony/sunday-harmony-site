---
name: "Area 12 Fix Plan - Setup / Seed / Ops Lockdown"
overview: "The setup endpoint and admin seed are already well-gated, and production env verification confirms SETUP_TOKEN and ADMIN_PASSWORD are unset, so bootstrap surfaces are disabled in production. Remaining fixes are small hygiene items: timing-safe secret comparisons, honest no-op reporting from the setup route, dead-code removal, and gitignoring local diagnostic dumps."
todos:
  - id: timing-safe-secrets
    content: "Use timing-safe comparison for SETUP_TOKEN and CRON_SECRET checks"
    status: pending
  - id: setup-honest-response
    content: "Make /api/setup report when seeding was skipped instead of claiming success"
    status: pending
  - id: dead-code-cleanup
    content: "Remove unused ensureSeedAdmin export and stray setup route comment"
    status: pending
  - id: gitignore-diagnostics
    content: "Gitignore diagnostic-report.* local dumps"
    status: pending
  - id: tests
    content: "Add focused test coverage for setup/ops gating"
    status: pending
isProject: false
---

# Area 12 - Deep Dive + Fix Plan

**Status:** plan-ready (awaiting implement)
**Priority:** P2
**Scope:** `/api/setup`, `seedAdmin`, `/api/internal/cleanup-credit-funding-staging`, bootstrap env vars, operational scripts, and local artifact hygiene.

---

## Summary

This is the smallest remaining area. Earlier areas already fixed the biggest risks here: Area 02 removed `seedAdmin` from the NextAuth `authorize` hot path, and Area 07 moved the setup route onto durable rate limiting. A live check of production environment variables confirms the operational lockdown is already real, not just theoretical.

---

## Findings

### 1. Production bootstrap is already disabled — Verified good

`npx vercel env ls production` shows `SETUP_TOKEN` and `ADMIN_PASSWORD` are **not set** in production:

- `/api/setup` POST returns 403 "Setup is disabled" before reading the request token.
- `seedAdmin()` returns immediately without touching the database.
- `CRON_SECRET`, `DISPUTE_LETTERS_API_SECRET`, and all Stripe/Supabase secrets are present as encrypted env vars.

No action needed beyond keeping these unset unless a re-seed is intentionally performed.

### 2. Secret comparisons are not timing-safe — Low

- `src/app/api/setup/route.ts`: `body.token !== setupToken` is a variable-time string compare.
- `src/app/api/internal/cleanup-credit-funding-staging/route.ts`: `request.headers.get('authorization') !== 'Bearer <secret>'` likewise.

Both are mitigated by durable rate limits (setup) and the low value of timing signals over HTTP, but the codebase already uses `crypto.timingSafeEqual` everywhere else (password crypto, MFA challenge, invite signing, verification tokens). These two should match that standard.

**Fix direction:** add a small shared `timingSafeStringEqual` helper (or reuse an existing one) and use it in both routes.

### 3. Setup route claims success when seeding no-ops — Low

When `ADMIN_PASSWORD` is unset, `seedAdmin()` silently returns, but the route still responds `"Admin account has been seeded."` An operator running a bootstrap could believe seeding worked when it did not.

**Fix direction:** have `seedAdmin()` return a result (`seeded` / `skipped` / reason) and reflect that in the setup response without leaking account details.

### 4. Dead export `ensureSeedAdmin` — Low

`src/lib/auth.ts` exports `ensureSeedAdmin()` (a one-line wrapper around `seedAdmin`) but nothing calls it. Also, `src/app/api/setup/route.ts` ends with a stray leftover comment (`// Bug fix: add try-catch around seedAdmin`).

**Fix direction:** delete both.

### 5. Local diagnostic dumps are not gitignored — Low

`diagnostic-report.json` and `diagnostic-report.md` sit untracked in the repo root. Commit rules exclude them manually, but `.gitignore` should enforce it so they can never be staged by accident (they can contain production probe output).

**Fix direction:** add `diagnostic-report.*` to `.gitignore`.

### 6. Hardcoded admin identity in seed — Informational

`seedAdmin` hardcodes `name: 'Mac Cesar'` and falls back to `sales@sundayharmony.com`. Acceptable for a single-owner business; noted only so it isn't a surprise. Seed uses `ignoreDuplicates: true`, so it can never overwrite an existing admin's password — good.

---

## Already solid

- Setup route is POST-only, token-gated, durably rate limited (3/15 min/IP), and fails closed when `SETUP_TOKEN` is unset.
- `seedAdmin` is out of the login hot path (Area 02) and cannot clobber existing users.
- Cron cleanup endpoint requires `CRON_SECRET` bearer auth; secret confirmed present in production.
- Operational scripts read secrets from `.env.local` (gitignored); the pre-commit secret scanner covers `ADMIN_PASSWORD` and `SETUP_TOKEN` assignments.
- No debug or env-dump endpoints exist under `src/app/api`.
- Middleware enforces MFA-verified sessions for all `/admin` pages; API authorization was audited in Area 06.

---

## Implementation plan

1. Add a timing-safe string comparison helper and use it for the `SETUP_TOKEN` check and the `CRON_SECRET` bearer check.
2. Change `seedAdmin()` to return `{ seeded: boolean, reason?: string }`; make `/api/setup` respond honestly (e.g., 200 seeded vs 409/200 skipped) without leaking admin details.
3. Remove the unused `ensureSeedAdmin` export and the stray comment in the setup route.
4. Add `diagnostic-report.*` to `.gitignore`.
5. Add focused tests: timing-safe comparison usage in both routes, setup fail-closed behavior without `SETUP_TOKEN`, and skipped-seed reporting.
6. Run focused tests, full unit tests, typecheck, and build.

---

## Acceptance criteria

- [ ] Setup token and cron secret comparisons are timing-safe.
- [ ] `/api/setup` distinguishes seeded vs skipped outcomes without leaking account details.
- [ ] `ensureSeedAdmin` dead code and stray comments removed.
- [ ] `diagnostic-report.*` ignored by git.
- [ ] Focused tests, full unit tests, typecheck, and build pass.

---

## Deferred / overlap

- **Area 02/03:** admin MFA and secret rotation already handled.
- Rotating or deleting `SETUP_TOKEN`/`ADMIN_PASSWORD` from production is a no-op — they are already unset (verified 2026-07-15).
