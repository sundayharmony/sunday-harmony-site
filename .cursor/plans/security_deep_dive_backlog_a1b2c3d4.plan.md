---
name: Security Deep Dive Backlog
overview: "Prioritized security areas to investigate one at a time. Each area: deep-dive analysis → fix plan → implement only after permission. Do not start the next area until the current one is closed or deferred."
todos:
  - id: area-01-storage-rls
    content: "P0 — Supabase storage privacy + RLS (client-files public risk, migration 017/020)"
    status: completed
  - id: area-02-admin-mfa
    content: "P0 — Admin/staff account takeover (no 2FA, session strength, seedAdmin)"
    status: completed
  - id: area-03-service-role
    content: "P0 — Service-role key concentration + secret/env hygiene"
    status: completed
  - id: area-04-password-crypto
    content: "P1 — Password hashing/compare hardening (PBKDF2 cost, timingSafeEqual)"
    status: in_progress
  - id: area-05-csp-xss
    content: "P1 — CSP tightening + dangerouslySetInnerHTML (dispute letters)"
    status: pending
  - id: area-06-api-authz
    content: "P1 — API authorization audit (IDOR, role gaps, middleware/API split)"
    status: pending
  - id: area-07-rate-limits
    content: "P1 — Rate limiting durability (Upstash vs memory fallback)"
    status: pending
  - id: area-08-credit-encryption
    content: "P1 — Credit-funding sensitive data (encryption coverage, admin decrypt UX)"
    status: pending
  - id: area-09-uploads
    content: "P2 — File upload & signed-session hardening"
    status: pending
  - id: area-10-stripe
    content: "P2 — Stripe webhook/billing authorization review"
    status: pending
  - id: area-11-public-surfaces
    content: "P2 — Public surfaces (invite tokens, case studies, contact/intake)"
    status: pending
  - id: area-12-setup-ops
    content: "P2 — Setup endpoint, admin seed, operational lockdown"
    status: pending
isProject: false
---

# Security Deep Dive Backlog

## How we work this

1. **Pick one area** (you choose; recommended order below).
2. **Deep dive** — read-only analysis of that area only (code, migrations, prod evidence where available).
3. **Fix plan** — concrete steps, files, risk, and suggested order of changes. No implementation yet.
4. **Implement** — only after you say go for that plan.
5. **Close or defer** the area, then ask permission before the next deep dive.

Do not combine areas in one pass unless you explicitly allow it.

---

## Area list (priority order)

### P0 — do first

| # | Area | Why it matters | Entry points |
|---|------|----------------|--------------|
| **01** | Supabase storage privacy + RLS | Diagnostic flagged `client-files` public; permissive RLS historically existed | `supabase-migration-017-*.sql`, `020-fix-permissive-rls.sql`, `011`, storage buckets, `diagnostics/supabase-verification.sql` |
| **02** | Admin / staff account takeover | No 2FA; admin can decrypt SSN/creds, CRM, Stripe, bulk email | `src/lib/auth.ts`, NextAuth config, admin session helpers |
| **03** | Service-role key + secret hygiene | One leaked key = full DB/storage; local `.env*` risk | `src/lib/supabase.ts`, `.gitignore`, deploy/env patterns |

### P1 — harden after P0

| # | Area | Why it matters | Entry points |
|---|------|----------------|--------------|
| **04** | Password crypto | 10k PBKDF2 + non-timing-safe compare | `src/lib/db.ts` (`hashPassword` / `verifyPassword`) |
| **05** | CSP + XSS | `unsafe-inline` / `unsafe-eval`; admin HTML render | `next.config.js`, dispute letter pages |
| **06** | API authorization audit | App owns access control; gaps = IDOR | `requireAdminSession`, `requireClientSession`, dashboard/admin APIs |
| **07** | Rate limiting durability | Memory fallback weak on serverless | `src/lib/rate-limit-durable.ts`, auth/intake routes |
| **08** | Credit-funding encryption coverage | Highest-sensitivity PII; verify encrypt/decrypt paths | `src/lib/credit-funding-sensitive-fields.ts`, intake + admin APIs |

### P2 — review and tighten

| # | Area | Why it matters | Entry points |
|---|------|----------------|--------------|
| **09** | Uploads & signed sessions | MIME/magic checks good; confirm TTL, abuse paths | `client-files-storage`, `credit-funding-upload-session` |
| **10** | Stripe webhooks & billing auth | Money + subscription state | `api/stripe/webhook`, `billing-access` |
| **11** | Public surfaces | Invite token PII, published PDFs, spam/abuse | invite route, case studies, contact |
| **12** | Setup / seed / ops lockdown | Token-gated setup, `seedAdmin` on authorize | `api/setup`, `seedAdmin` in auth |

---

## Status tracker

| Area | Status | Deep dive | Fix plan | Implemented |
|------|--------|-----------|----------|-------------|
| 01 Storage + RLS | done | 2026-07-14 | [fix plan](security_area_01_storage_rls_fix_plan.md) | verified PASS |
| 02 Admin MFA / takeover | done | 2026-07-14 | [fix plan](security_area_02_admin_mfa_fix_plan.md) | code shipped; run migration 025 |
| 03 Service-role / secrets | done | 2026-07-14 | [fix plan](security_area_03_secrets_hygiene_fix_plan.md) | shipped; rotation deferred |
| 04 Password crypto | plan-ready | 2026-07-14 | [fix plan](security_area_04_password_crypto_fix_plan.md) | — |
| 05 CSP + XSS | pending | — | — | — |
| 06 API authz | pending | — | — | — |
| 07 Rate limits | pending | — | — | — |
| 08 Credit encryption | pending | — | — | — |
| 09 Uploads | pending | — | — | — |
| 10 Stripe / billing | pending | — | — | — |
| 11 Public surfaces | pending | — | — | — |
| 12 Setup / ops | pending | — | — | — |

Statuses: `pending` → `diving` → `plan-ready` → `implementing` → `done` | `deferred`

---

## Recommended first pick

**Area 01 — Supabase storage privacy + RLS**

Highest chance of actual data exposure already flagged in production diagnostics, and you already have migration 020 open. Analysis would verify buckets/policies and produce a short fix plan (apply/verify migrations + confirmation queries).
