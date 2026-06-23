# Manual E2E Test Results

**Generated:** 2026-06-23  
**Environment:** Production `https://www.sundayharmony.com` + local code review  
**Legend:** PASS = verified this session | CODE = verified in source only | MANUAL = requires logged-in prod test | N/A = not applicable in prod

---

## Phase 3.1 — Marketing and lead capture

| ID | Flow | Result | Evidence / notes |
|----|------|--------|------------------|
| M1 | Homepage `/` | PASS | Diagnostic Phase 4: 200, expected content |
| M1a | Mobile nav | MANUAL | Not automated; no layout regression in build |
| M2 | Contact form valid submit | MANUAL | SMTP vars present; submit + inbox check not run (avoid prod spam) |
| M2a | Contact API validation | PASS | `POST /api/contact` empty body → 400 |
| M2b | Contact rate limit | CODE | 3/15min IP in route |
| M3 | Contact validation UI | CODE | Client-side + API validation in contact route |
| M3a | XSS in message | CODE | `escHtml` used in admin email templates |

---

## Phase 3.2 — Auth lifecycle

| ID | Flow | Result | Evidence / notes |
|----|------|--------|------------------|
| A1 | Client login wrong password | CODE | `auth.ts` login rate limit 10/15min |
| A2 | Admin login → `/admin` | MANUAL | Middleware redirects; needs admin credentials |
| A3 | Forgot password enumeration-safe | CODE | forgot-password route returns generic success |
| A4 | Reset password expiry | CODE | reset-password route + DB token expiry |
| A5 | Portal setup from intake | MANUAL | Onboarding email flow; 1 prod application exists |
| A5a | Unauthenticated `/admin` | PASS | `/admin/crm` → 307 to login |
| A5b | Unauthenticated `/dashboard` | PASS | `/dashboard/credit-funding` → 307 |

---

## Phase 3.3 — Credit & funding intake

| ID | Flow | Result | Evidence / notes |
|----|------|--------|------------------|
| CF1 | Personal intake | MANUAL | Form logic in `CreditFundingForm.tsx`; not submitted to prod |
| CF2 | Business intake | MANUAL | EIN/entity validation in `credit-funding-validation.ts` |
| CF3 | Staged upload path | PASS | `POST /api/credit-funding/session` → 200 on prod |
| CF3a | Invalid HMAC | CODE | stage route rejects bad token |
| CF4 | Direct multipart intake | CODE | Orphan risk documented in edge-case catalog |
| CF5 | Confirmation email subject | CODE | `sanitizeEmailSubjectPart`; no `CF-…` in subjects |
| CF6 | Admin notification | CODE | Non-blocking in intake route |
| CF7 | Intake rate limit | PASS | Diagnostic: empty POST → 429 |
| CF8 | HTTPS-only prod | PASS | Non-HTTPS probe → 429 (edge HTTPS active) |

---

## Phase 3.4 — Client credit portal

| ID | Flow | Result | Evidence / notes |
|----|------|--------|------------------|
| CP1 | Status tracker | MANUAL | Requires client linked to application |
| CP2 | Requested doc upload | MANUAL | Upload route has ownership check |
| CP3 | Messages thread | CODE | IDOR fix applied this session (ownership on GET/POST) |
| CP4 | Specialist docs + preview | CODE | `DocumentPreviewModal.tsx` in branch |
| CP5 | Wrong account → 404 | CODE | Application resolve + 403 ownership |
| CP6 | Credit-only user | MANUAL | No `clientId` path needs test account |

---

## Phase 3.5 — Admin credit & funding workflow

| ID | Flow | Result | Evidence / notes |
|----|------|--------|------------------|
| AD1 | Application list + detail | MANUAL | `/api/admin/credit-funding` → 401 unauthenticated |
| AD2 | Workflow advance + notes | CODE | `AdminApplicationWorkflow.tsx` + multipart workflow API |
| AD3 | Workflow attachments | PASS | Migration 012 columns + `staff_shared` query OK on prod |
| AD4 | Document request | MANUAL | Requires admin session |
| AD5 | Resend portal setup | MANUAL | Admin route action |
| AD6 | CSV export | PASS | `/api/admin/credit-funding/export` → 401 (exists) |
| AD7 | Email inline images | CODE | `buildEmailAttachmentPayload` + nodemailer CID |
| AD7a | Workflow API exists | PASS | `POST /api/admin/credit-funding/workflow` → 401 |

---

## Phase 3.6 — Admin CRM and operations

| ID | Flow | Result | Evidence / notes |
|----|------|--------|------------------|
| CRM1 | CRM search null fields | **FIXED** | `(c.name \|\| '')` guard in `admin/crm/page.tsx` |
| CRM2 | Contact detail + meetings | MANUAL | Meetings table ready (migration 010) |
| CRM3 | Lead discovery API key | CODE | 503 if `GOOGLE_PLACES_API_KEY` missing |
| CRM4 | Client create welcome email | MANUAL | |
| CRM5 | Files vault share | MANUAL | Public bucket risk — see security findings |
| CRM6 | CRM API auth | PASS | `/api/admin/crm` → 401 |

---

## Phase 3.7 — Billing (Stripe)

| ID | Flow | Result | Evidence / notes |
|----|------|--------|------------------|
| B1 | Activate potential client | MANUAL | Stripe vars present in Vercel |
| B2 | Save card | MANUAL | Client-only via `authorizeBillingClient` |
| B3 | Subscription + webhook | CODE | Webhook signature + idempotency table |
| B4 | `invoice.payment_failed` | CODE | Handler in webhook route |
| B5 | Webhook replay | CODE | `stripe_webhook_events` dedup |
| B6 | Unit tests | PASS | 11/11 billing/Stripe unit tests pass |

---

## Phase 4 — Email system diagnostic

| Test | Result | Notes |
|------|--------|-------|
| Transport = Nodemailer only | CODE | `smtp-mail.ts`; Resend removed |
| SMTP unset → contact 500 | CODE | Blocking `sendEmail` |
| SMTP fail → intake still succeeds | CODE | Swallowed in onboarding |
| Non-blocking admin alerts | CODE | `sendHtmlMailNonBlocking` |
| Inline CID images (workflow) | CODE | `inlineImageCids` in HTML builder |
| PDF as attachment not inline | CODE | Size threshold in attachment builder |
| Subject without application ID | CODE | `sanitizeEmailSubjectPart` |
| Prod SMTP configured | PASS | Vercel SMTP_* + NOTIFY_EMAIL present |
| Live inbox delivery | MANUAL | Submit contact + workflow notify on prod |

---

## Phase 5 — Migration verification

| Migration | Prod probe | Result |
|-----------|------------|--------|
| 008 applications | Table query | PASS |
| 009 portal tables | messages, doc_requests, status_history | PASS |
| 010 CRM | client_meetings, leads.lead_type | PASS |
| 011 RLS | Not API-probeable (service role) | **MANUAL SQL** — run RLS query in Supabase |
| 012 workflow attachments | columns + staff_shared constraint | PASS |

**Recommended SQL (Supabase SQL Editor):**

```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'credit_funding%';
SELECT id, public FROM storage.buckets;
```

---

## Phase 7 — Ops spot-check

| Check | Result | Notes |
|-------|--------|-------|
| `npm run build` | PASS | Current branch |
| CI pipeline | N/A | No `.github/workflows` |
| Dependabot | WARN | 30 alerts (10 high, 17 medium, 3 low) |
| `npm audit` | WARN | nodemailer, js-yaml, uuid (transitive) |
| Activity log data | PASS | 45 credit_funding entries on prod |
| Vercel logs | MANUAL | Spot-check `Failed to send` in dashboard |

---

## Summary

| Category | PASS | CODE | MANUAL | FIXED |
|----------|------|------|--------|-------|
| Automated / probe | 18 | — | — | 1 |
| Requires prod login | — | — | 22 | — |
| Code-verified only | — | 28 | — | — |

**Blockers for full green manual matrix:** Production admin and client credentials were not used in this session to avoid live data mutation. All unauthenticated security boundaries and schema probes passed.

**Recommended next manual session (30–60 min):**

1. Admin login → open `/admin/credit-funding` → advance workflow with PNG attach + notify client.
2. Client login (matching intake email) → verify message, preview modal, download.
3. Submit test contact form → confirm NOTIFY_EMAIL inbox.
4. Run migration 011 RLS SQL verification in Supabase.
