# Phase 0 — Diagnostic Baseline

**Generated:** 2026-06-23  
**Repository:** sunday-harmony-site  
**Branch under test:** `cursor/admin-billing-plan-save`  
**Local HEAD:** `503d785` — Add full-screen document preview in portal and embed workflow images in client emails.

## Production target

| Item | Value |
|------|-------|
| URL | https://www.sundayharmony.com |
| Production diagnostic | PASS 10 / WARN 1 / FAIL 0 (see `diagnostic-report-v2.json`) |
| Feature routes deployed | `/credit-funding`, `/api/credit-funding/*`, `/api/admin/credit-funding/workflow` confirmed |

## Branch delta vs `main`

`main` is at `56d9356`. This branch is **15 commits ahead**, including:

- Credit & funding portal and CRM enhancements
- SMTP migration (Resend removed)
- Staged intake uploads
- Admin workflow stepper + step attachments
- PII encryption + RLS migration files
- Email subject cleanup, staff doc persistence, document preview

**Recommendation:** Merge `cursor/admin-billing-plan-save` → `main` and promote Vercel production after review.

## Vercel Production environment (names only)

**Required (verified present):** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SMTP_*`, `NOTIFY_EMAIL`, `CREDIT_FUNDING_ENCRYPTION_KEY`

**Billing (present):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**Also present:** `GOOGLE_PLACES_API_KEY`, `SMTP_FROM_EMAIL`, Postgres/Supabase integration vars from Vercel

**Not in `.env.example` but used in code — verify in Vercel:**

- `ADMIN_PASSWORD` / `ADMIN_EMAIL` (admin seed on login)
- `SETUP_TOKEN` (one-time setup route; should be unset in prod unless needed)

## Supabase migration state (live probe via diagnostic Phase 3)

| Migration | Status |
|-----------|--------|
| 008 credit_funding_applications | ready |
| 009 status_history, messages, doc_requests | ready |
| 010 client_meetings, leads.lead_type | ready |
| 011 credit_funding RLS | not explicitly probed (service role bypasses) |
| 012 staff_shared + shared_by columns | **ready** (columns + staff_shared query ok) |
| storage `credit-funding-docs` | ready (private) |
| storage `client-files` | **public: YES (security risk)** |

## Local automated checks (this run)

| Check | Result |
|-------|--------|
| `npm run lint` | PASS (warnings only) |
| `npm run build` | PASS |
| `npm run test:unit` | PASS (11 tests) |
| `npm run test:e2e` | PASS (2 smoke tests) |
| `npm run diagnostic:prod` | PASS 10, WARN 1 |

## Fixes applied during this diagnostic session

1. **IDOR:** Added ownership check to `src/app/api/dashboard/credit-funding/messages/route.ts` (matches upload route).
2. **CRM crash:** Null-safe search in `src/app/admin/crm/page.tsx` for `name` / `business`.
3. **Diagnostic script:** Extended to Phase 11 (migrations 012, public bucket check, workflow API probe).
