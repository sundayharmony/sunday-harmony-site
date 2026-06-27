# Remediation Backlog — updated after audit remediation implementation

**Updated:** 2026-06-23

## Completed in audit remediation

| Item | Status |
|------|--------|
| Activity log IDOR (`/api/dashboard/activity`) | **DONE** |
| Settings password user ID mismatch | **DONE** |
| Credit intake rollback + idempotency key | **DONE** |
| Case study storage existence check + migration 019 diagnostic probe | **DONE** |
| Gemini rate limit, admin file_url validation, admin/data whitelist | **DONE** |
| Upload session TTL-only tokens (legacy removed) | **DONE** |
| Public perf: dynamic credit form, server case studies, lazy PDF, font trim | **DONE** |
| Lib dedup: storage-utils, stripe-invoice-utils, credit-funding-signing, escHtml | **DONE** |
| UI dedup: SectionHeader, PublicPageLayout, siteNavLinks, AuditCtaButton, auth/settings | **DONE** |
| `requireClientSession`, hooks (`useAdminClients`, `useAdminToolkitData`, `useDashboardProfile`) | **DONE** |
| CI workflow (lint + typecheck + unit), `.env.example` gaps, bundle baseline doc | **DONE** |

## Still open (follow-up)

| ID | Item | Priority |
|----|------|----------|
| O-1 | Verify migration 019 + 011 RLS applied in Supabase production | P0 ops |
| O-2 | Configure Upstash in Vercel production | P1 |
| O-3 | Private `client-files` bucket if still public | P1 |
| O-4 | Replace plaintext password in admin welcome email with setup link | P1 |
| O-5 | Gemini responses to signed URLs instead of inline base64 | P2 |
| O-6 | Playwright E2E expansion | P3 |
| O-7 | Admin TOTP 2FA | P3 |
