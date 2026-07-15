---
name: "Area 13 Fix Plan - Residual Follow-ups (deps, ops, CSP, rotation)"
overview: "All 12 deep-dive areas are shipped. This area collects everything left: 7 open Dependabot alerts (2 high), the unapplied Stripe uniqueness migration 026, credit_manager MFA enrollment, the deferred CSP nonce migration to remove script-src unsafe-inline, and the deferred secret rotation. Items 1 and 4 are code work; 2, 3, and 5 are operator actions with verification support."
todos:
  - id: dep-nodemailer
    content: "Upgrade nodemailer to ^9.0.3 (direct dep AND the overrides pin) — clears 1 high + 3 medium alerts"
    status: pending
  - id: dep-transitive
    content: "Update ws to >=8.21.0 and js-yaml to >=4.2.0 via npm update"
    status: pending
  - id: dep-uuid
    content: "Override transitive uuid (via next-auth) to ^11.1.1; verify login flow; fall back to documented dismissal if next-auth breaks"
    status: pending
  - id: ops-migration-026
    content: "Apply supabase-migration-026-stripe-billing-uniqueness.sql to production (operator, SQL editor) after duplicate pre-check"
    status: pending
  - id: ops-mfa-enroll
    content: "credit_manager enrolls TOTP at /login/mfa/setup (operator); verify totp_enabled=true"
    status: pending
  - id: csp-nonce
    content: "Move CSP to middleware with per-request nonce; drop script-src 'unsafe-inline' (Report-Only first, then enforce)"
    status: pending
  - id: secret-rotation
    content: "Secret rotation runbook execution (needs explicit approval; NEXTAUTH_SECRET logs everyone out; encryption key needs re-encrypt pass)"
    status: pending
isProject: false
---

# Area 13 - Deep Dive + Fix Plan

**Status:** plan-ready (awaiting implement)
**Priority:** mixed (P1 items 1-3, P2 items 4-5)
**Scope:** Everything left open after Areas 01-12: dependency vulnerabilities, two pending operator actions, and the two explicitly deferred projects (CSP nonce migration, secret rotation).

---

## Verified current state (2026-07-15)

- Area 11 case-study migration **applied**: bucket private, 0 legacy storage URLs in `client_case_studies`.
- Migration 025 (staff MFA columns) **applied**: admin has `totp_enabled=true`.
- `credit_manager` account has `totp_enabled=false` — not yet enrolled.
- Migration 026 **unverified/likely unapplied** (no SQL access from local env; MCP token scoped to a different project).
- 7 open Dependabot alerts on `package-lock.json` (2 high, 5 moderate).

---

## 1. Dependency vulnerabilities — P1, code

Live alert data (patched version = first fixed):

| Package | Current | Severity | Patched | Path |
|---------|---------|----------|---------|------|
| nodemailer | 8.0.7 | high + 3 medium | 9.0.1 (latest 9.0.3) | direct dep + `overrides` pin |
| ws | 8.20.1 | high | 8.21.0 | transitive via `@supabase/realtime-js` |
| js-yaml | 4.1.1 | medium | 4.2.0 | transitive via `eslint` (dev-only) |
| uuid | 8.3.2 | medium | 11.1.1 | transitive via `next-auth@4` (pins `^8.3.2`) |

Fix directions:

1. **nodemailer:** bump the direct dependency from `^8.0.7` to `^9.0.3` **and** update the `overrides.nodemailer` entry (currently `^8.0.7`, which force-pins the vulnerable version). Only consumer is `src/lib/smtp-mail.ts` (`createTransport`/`sendMail` — API unchanged in v9). Bump `@types/nodemailer` to latest.
2. **ws / js-yaml:** `npm update ws js-yaml` — both fixes are within existing semver ranges (`fixAvailable=true`).
3. **uuid:** next-auth v4 will never move off `^8.3.2`. Add `overrides.uuid: "^11.1.1"` and verify the credentials login flow end-to-end (uuid v11 keeps the `v4` export and CJS entry next-auth uses). If anything breaks, remove the override and dismiss the alert as tolerable risk with a note — the bug requires the caller to pass a `buf` argument, which next-auth does not do.
4. Ignore npm audit's `next-auth` line — it is only flagged because of its nodemailer/uuid children and audit's suggested "fix" is a nonsense downgrade to `next-auth@1.12.1`.

Verification: `npm audit` clean (or only documented residuals), full unit tests, typecheck, build, and a real email send via the contact form path if SMTP is reachable locally (otherwise an import/createTransport smoke test).

## 2. Apply migration 026 (Stripe uniqueness) — P1, operator

`supabase-migration-026-stripe-billing-uniqueness.sql` creates partial unique indexes on `clients.stripe_customer_id` / `stripe_subscription_id`. It is idempotent (`IF NOT EXISTS`).

**Caveat:** unique index creation fails if duplicate non-empty values already exist. Pre-check first (read-only, can run via service role):

```sql
SELECT stripe_customer_id, count(*) FROM clients
WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id <> ''
GROUP BY 1 HAVING count(*) > 1;
-- repeat for stripe_subscription_id
```

If clean, run the migration in the Supabase SQL editor (project `hvsoeezsbvwsrdobvgaz`). I can run the pre-check from here; the DDL itself needs the SQL editor since local env has no Postgres connection string.

## 3. credit_manager MFA enrollment — P1, operator

Person action: the credit manager logs in and completes TOTP setup at `/login/mfa/setup`. Afterwards I verify `totp_enabled=true` with a read-only check. No code change.

## 4. CSP nonce migration (remove `script-src 'unsafe-inline'`) — P2, code

Deferred from Areas 05/11. Current CSP is a static header in `next.config.js`.

Approach:

1. Generate a per-request nonce in `src/middleware.ts`, set the full CSP header there (with `'nonce-...'` and `'strict-dynamic'` in `script-src`), and pass the nonce via the `x-nonce` request header. Next.js picks it up automatically for its own inline bootstrap scripts.
2. Remove the CSP entry from `next.config.js` headers (other security headers stay); keep the CSP test fixtures in sync.
3. Keep `style-src 'unsafe-inline'` for now (styled-jsx/Tailwind inline styles) — this migration targets `script-src` only.
4. Audit for literal inline `<script>`/`dangerouslySetInnerHTML` usages and third-party scripts (`va.vercel-scripts.com`, Stripe) that need nonce or `strict-dynamic` treatment.
5. Ship as `Content-Security-Policy-Report-Only` first, watch `/api/csp-report` for violations for a few days, then flip to enforce.

Note: nonce-based CSP forces dynamic rendering on every page. Public marketing pages are currently static/ISR — this needs a check; if the perf cost is unacceptable, fall back to hash-based CSP for the static shell.

## 5. Secret rotation — P2, operator, **needs explicit approval**

Deferred from Area 03; no evidence of leak, so this is periodic hygiene. Impact notes per secret:

| Secret | Rotation impact |
|--------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | none visible; update Vercel + `.env.local`, redeploy |
| `NEXTAUTH_SECRET` | **logs out all users/staff**; MFA-verified sessions must re-login |
| `STRIPE_SECRET_KEY` / webhook secret | roll key in Stripe dashboard, update webhook endpoint secret |
| `SMTP_PASS` | update at provider + env |
| `CRON_SECRET`, `DISPUTE_LETTERS_API_SECRET`, `SETUP_TOKEN` | CRON already rotated in Area 12; SETUP_TOKEN unset in prod |
| `CREDIT_FUNDING_ENCRYPTION_KEY` | **do not blind-rotate** — existing ciphertext must be re-encrypted; requires a migration script that decrypts with old key and re-encrypts with new (versioned ciphertext supports this) |

Fix direction when approved: rotate the cheap ones in one pass (service role, Stripe, SMTP), schedule `NEXTAUTH_SECRET` for a low-traffic window, and treat the encryption key as its own mini-project with a re-encrypt script + verification.

---

## Suggested execution order

1. Dependencies (item 1) — code, immediately verifiable.
2. Migration 026 pre-check + apply (item 2) — unblocks the Area 10 uniqueness guarantee.
3. MFA enrollment (item 3) — whenever the credit manager is available.
4. CSP nonce migration (item 4) — separate implementation pass with Report-Only soak.
5. Secret rotation (item 5) — only on your explicit go-ahead.

## Acceptance criteria

- [ ] Dependabot shows 0 open alerts (or only explicitly dismissed ones with documented rationale).
- [ ] `npm audit` reports no high/critical findings.
- [ ] Unique Stripe indexes exist in production (`idx_clients_stripe_customer_id_unique`, `idx_clients_stripe_subscription_id_unique`).
- [ ] All staff accounts (`admin`, `credit_manager`) have `totp_enabled=true`.
- [ ] Production CSP `script-src` has no `'unsafe-inline'`, with a clean Report-Only soak beforehand.
- [ ] Rotation executed per runbook or explicitly deferred again with a date.
