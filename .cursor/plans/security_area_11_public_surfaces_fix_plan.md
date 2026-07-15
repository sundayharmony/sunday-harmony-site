---
name: "Area 11 Fix Plan - Public Surfaces"
overview: "The public surface is relatively small and previous areas already hardened rate limits, upload sessions, file scanning, intake encryption, and Stripe webhooks. Remaining risks are lifecycle and abuse controls: published case-study PDFs are permanent public Supabase URLs, credit-funding invite links reveal contact PII to any token holder for up to 30 days, public forms lack bot friction beyond IP limits, and CSP still permits inline scripts."
todos:
  - id: case-study-public-lifecycle
    content: "Make public case-study PDF exposure revocable, preferably private bucket plus app-minted signed read URLs"
    status: pending
  - id: invite-token-hygiene
    content: "Add invite token revocation/single-use semantics and reduce PII returned by public invite validation"
    status: pending
  - id: public-bot-defense
    content: "Add honeypot or lightweight bot challenge to contact and credit-funding public entry points"
    status: pending
  - id: public-referrer-policy
    content: "Prevent invite token leakage through referrers on the credit-funding invite flow"
    status: pending
  - id: csp-inline-followup
    content: "Plan a CSP nonce/hash migration to remove script-src unsafe-inline after public-surface changes settle"
    status: pending
  - id: tests
    content: "Add focused public-surface tests for invite redaction/revocation, case-study access lifecycle, and bot-field rejection"
    status: pending
isProject: false
---

# Area 11 - Deep Dive + Fix Plan

**Status:** plan-ready (awaiting implement)
**Priority:** P2
**Scope:** Public pages and unauthenticated APIs: case studies, contact, credit-funding invite/intake/upload session, CSP report, setup, password reset, Stripe webhook, and public content headers.

---

## Summary

The public attack surface is much smaller after Areas 07-10:

- Public credit-funding upload sessions are HMAC-signed, byte-scanned, path-hardened, and cleaned by cron.
- Credit-funding intake encrypts sensitive fields at rest.
- Invite/session/stage/intake/contact/CSP routes have durable rate limits.
- Setup is token-gated, password reset is anti-enumeration, Stripe webhook is signature-gated, and case-study uploads are scanned before publication.

Remaining issues are mostly about **what intentionally public data stays public**, **how long bearer links remain useful**, and **how much friction public forms impose on bots**.

---

## Findings

### 1. Published case-study PDFs are permanent public objects - Medium

`supabase-migration-016-client-case-studies.sql` creates `client-case-studies` as a public bucket and grants public SELECT on storage objects. `getCaseStudyPublicUrl` returns a permanent public URL, and both the public API and SSR page return it directly.

Consequences:

- Unpublishing a case study removes it from the listing, but any previously shared object URL remains fetchable until the object is deleted or moved.
- Supabase/CDN caches and third-party previews can retain the PDF URL.
- Object paths include UUIDs, so enumeration is unlikely, but bearer URL leakage is enough.

**Fix direction:** Prefer making the bucket private and serving case studies through an app route that verifies `published` and mints short-lived signed URLs. If marketing intentionally requires permanent public PDFs, delete/rotate objects on unpublish and document that admins must never upload sensitive client data.

### 2. Credit-funding invite validation returns contact PII to any token holder - Medium

`GET /api/credit-funding/invite` returns `fullName`, `email`, and `phone` when a stateless HMAC invite token is valid. The token TTL is 30 days, and older invite links are not invalidated when a new invite is sent.

Signature strength prevents guessing, and the route also checks `invitation_pending`, but anyone with a forwarded/scanned/leaked email link can replay it for contact PII until expiry or status change.

**Fix direction:** Add token versioning or a stored nonce/hash to the application row so regenerated or consumed links invalidate older links. Reduce the response to the minimum needed for UX (for example first name and masked email/phone), and set no-referrer behavior for the invite page.

### 3. Public forms rely on rate limits but have no bot friction - Low/Medium

`POST /api/contact`, credit-funding session/stage/intake, and public auth recovery routes use durable IP limits. That is good baseline abuse control, but the contact form and credit-funding form have no honeypot, Turnstile/CAPTCHA, or behavioral spam check.

Impact: determined bots can still create lead/email noise and consume anonymous staging quota within configured limits, especially during Redis degradation when the durable limiter falls back to per-instance memory.

**Fix direction:** Add a hidden honeypot field to contact and credit-funding public forms first. Consider Turnstile on contact and upload-session minting if spam continues. Decide separately whether public non-auth endpoints should fail closed when Redis is unavailable.

### 4. Invite URLs can leak via referrer headers - Low

Global `Referrer-Policy` is `strict-origin-when-cross-origin`. That protects tokens from cross-origin referrer leakage, but same-origin analytics/scripts/navigation can still observe full URLs. The invite token is in the query string on `/credit-funding?invite=...`.

**Fix direction:** Add a stricter route-level header for `/credit-funding` (`Referrer-Policy: no-referrer`) or move invite tokens into short-lived POST/session state after the first page load.

### 5. CSP still allows inline scripts - Low

The global CSP includes `script-src 'unsafe-inline'`. No current public XSS sink was found in this pass, and public email HTML is escaped, but inline script permission weakens the blast-radius reduction that CSP is supposed to provide.

**Fix direction:** Treat this as a dedicated CSP follow-up: introduce nonce/hash support, monitor the existing CSP report sink, and remove `unsafe-inline` once compatible.

---

## Already solid

- Case-study uploads are PDF-only, byte-scanned, and size-checked before publish.
- Credit-funding upload sessions and staged metadata are HMAC-signed with server-owned clean status.
- Public credit-funding intake re-validates invite tokens and requires the submitted email to match the invited email.
- PII stored by credit-funding intake is encrypted at rest from Area 08.
- Contact form HTML escapes submitted fields and sanitizes email subjects.
- Forgot-password avoids account enumeration; reset codes are hashed.
- Setup and cron endpoints are bearer-secret gated.
- Stripe webhook verifies Stripe signatures before processing.

---

## Implementation plan

1. **Case-study access lifecycle:** convert public PDF delivery to an app route that checks `published` and returns a short-lived signed URL or streamed response. Add a migration to make `client-case-studies` private and remove public object SELECT, or implement delete/rotate-on-unpublish if public bucket must remain.
2. **Invite token revocation:** add a token nonce/version/hash field to credit-funding applications/invitations. Include it in invite token signing, reject stale tokens, and mark tokens consumed or superseded when intake completes/new invite is sent.
3. **Invite response minimization:** return only masked email/phone or only the fields needed to confirm the invite. Keep full email verification on intake server-side.
4. **Referrer hardening:** add a `/credit-funding` route-specific no-referrer header and/or replace query token with server-validated ephemeral state after first load.
5. **Bot friction:** add honeypot fields to contact and credit-funding forms; reject filled honeypots server-side. Consider Turnstile if observed spam remains.
6. **CSP follow-up:** plan nonce/hash support for scripts and use `/api/csp-report` to validate before removing `unsafe-inline`.
7. **Tests:** add source/unit coverage for invite token version rejection, masked invite responses, case-study unpublished access denial, honeypot rejection, and relevant headers.

---

## Acceptance criteria

- [ ] Unpublished/replaced case-study PDFs are no longer fetchable through old public URLs, or object deletion/rotation is enforced and documented.
- [ ] A regenerated or consumed credit-funding invite link invalidates older tokens.
- [ ] Public invite validation no longer returns full phone/email by default.
- [ ] `/credit-funding` invite pages do not leak full invite URLs through referrers.
- [ ] Contact and credit-funding public forms reject bot honeypot submissions.
- [ ] Focused tests, full unit tests, typecheck, and build pass.

---

## Deferred / overlap

- **Area 07:** fail-open vs fail-closed rate limiter behavior is a broader availability/security trade-off.
- **Area 09:** case-study byte scanning is already handled there; Area 11 owns public URL lifecycle.
- **Area 05:** removing CSP `unsafe-inline` is a bigger CSP migration and should be isolated if it risks broad frontend churn.
- **Area 12:** setup endpoint operational lockdown remains separate; public review found it token-gated and rate-limited.
