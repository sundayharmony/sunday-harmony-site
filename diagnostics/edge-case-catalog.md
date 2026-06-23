# Edge Case Catalog

**Generated:** 2026-06-23  
**Purpose:** Exhaustive catalog of failure modes, race conditions, and UI edge cases for Sunday Harmony.

---

## 6.1 Concurrency and partial failure

| Scenario | Behavior | Mitigation / follow-up |
|----------|----------|------------------------|
| Credit intake: DB insert succeeds, document upload fails | Orphan application visible in admin without docs | P2: transaction or compensating delete job |
| Admin workflow: status saved, `uploaded_documents` insert fails | Files may exist in storage | `syncStaffSharedDocumentsFromStorage` backfill on portal load |
| Client vault: storage OK, DB insert fails | Admin upload route should rollback storage | Verify rollback in `admin/files` upload handler |
| Stripe webhook handler throws | `releaseStripeWebhookEvent` allows Stripe retry | Idempotency via `stripe_webhook_events` |
| Parallel credit-funding intake (same IP) | In-memory limiter race possible on multi-instance | P1: durable rate limit store |
| Workflow email send fails | Portal message/docs still created if DB path succeeds | Non-blocking email; check Vercel logs |

---

## 6.2 Null / empty data UI crashes

| Location | Risk | Status |
|----------|------|--------|
| `admin/crm/page.tsx` search | `.toLowerCase()` on null `name`/`business` | **Fixed** — null coalescing |
| `NotificationBell.tsx` | Non-array notifications JSON | CODE: defensive parsing recommended |
| Signed URL null / expired | Preview shows unavailable | Acceptable; user refreshes page |
| `admin/page.tsx` MRR | Null `monthly_price` → NaN | MANUAL: verify with null billing row |
| CRM export / reports | Empty datasets | Should render empty state |

---

## 6.3 Auth edge cases

| Scenario | Expected behavior |
|----------|-------------------|
| User `role` changed in DB mid-session | JWT refresh reloads user on next request |
| User deleted while logged in | Session invalidated on refresh |
| Admin calls `/api/dashboard/*` directly | Middleware bypass; some routes allow admin role |
| Two applications same email | Latest application resolved by email lookup |
| Session without email claim | 401 on dashboard credit-funding APIs |
| Wrong email vs application | 403 on messages (post-fix); 404 if no application |

---

## 6.4 File and preview edge cases

| Scenario | Behavior |
|----------|----------|
| Signed URL expires (~1h) | Preview/download fails until page reload regenerates URL |
| Filename spaces / unicode | Sanitized in storage path helpers |
| Workflow PNG &lt;1MB | Inline CID in client email |
| Workflow PDF / large image | Attachment download in email |
| 5 attachment limit per workflow step | Enforced in workflow route |
| `notify_client=false` | Portal still receives message/docs; no email |
| `client-files` public URL | **Risk:** permanent URL without auth |
| Rename `.exe` to `.pdf` (credit funding) | Rejected by magic-byte / PE heuristic |
| Client vault upload without magic-byte check | Executable may upload — P1 fix |

---

## 6.5 Rate limit bypass attempts

| Vector | Current defense | Gap |
|--------|-----------------|-----|
| Rotate IP (`x-forwarded-for`) | Trust Vercel/proxy headers | Misconfigured proxy could spoof |
| Burst parallel intake | In-memory per-instance bucket | Cross-instance bypass |
| Admin API spam | None | No rate limits on admin routes |
| Forgot-password email flood | IP + email limits | Adequate for single instance |
| Credit-funding session minting | 20/hr IP | Adequate pattern |

---

## 6.6 Dependency and supply chain

| Item | Detail |
|------|--------|
| `npm audit` | nodemailer (high), js-yaml (moderate), uuid via next-auth (moderate) |
| Dependabot | 30 open alerts on default branch (10 high) |
| `BUG_AUDIT_REPORT.md` | Historical only — do not file tickets without repro on current tree |
| No CI | Lint/unit not enforced on PR merge |

---

## 6.7 Email-specific edge cases

| Scenario | Expected |
|----------|----------|
| SMTP credentials invalid | Contact may 500; intake succeeds without confirmation |
| Empty `NOTIFY_EMAIL` | Admin alerts skipped silently |
| Very long subject parts | Truncated/sanitized via `sanitizeEmailSubjectPart` |
| HTML injection in workflow note | `escHtml` in templates |

---

## 6.8 Data / encryption edge cases

| Scenario | Expected |
|----------|----------|
| `CREDIT_FUNDING_ENCRYPTION_KEY` missing in prod | Intake should fail at encrypt |
| Dev without encryption key | Fallback dev key — must not ship to prod |
| Admin list view | Masked PII; detail decrypts |
| CSV export | Masked fields per export helper |

---

## Test reproduction checklist

Use this when validating fixes:

1. **Orphan intake:** Submit intake, kill network mid-upload → confirm admin sees app without docs.
2. **Signed URL expiry:** Open portal preview, wait &gt;1h, retry without refresh.
3. **IDOR messages:** (Was vulnerable) Client A session + Client B application UUID → expect 403.
4. **CRM null search:** Lead with null business name → search should not throw.
5. **Public client-files:** Obtain URL from shared file → access without login (documents risk).
