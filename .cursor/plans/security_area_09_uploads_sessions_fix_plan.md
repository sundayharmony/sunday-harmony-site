---
name: "Area 09 Fix Plan - File Upload & Signed-Session Hardening"
overview: "Credit-funding staging sessions already use HMAC-signed tokens, server-signed file metadata, magic-byte scanning, and private buckets. The main remaining risks are orphaned staging objects with no TTL cleanup, a client-files JSON path that signs foreign object paths by shape alone, admin direct-to-storage uploads that skip byte scanning, and spoofable IP-based upload throttles."
todos:
  - id: staging-ttl-cleanup
    content: "Add cron/protected cleanup for orphaned credit-funding staging objects and purge staging on intake failure paths"
    status: completed
  - id: client-files-path-ownership
    content: "Require dashboard JSON file records to reference storage paths under the session clientId, or remove the JSON branch"
    status: completed
  - id: signed-upload-byte-scan
    content: "Add post-upload magic-byte/PE scanning before case-study publish and dispute-letter analyze usability"
    status: completed
  - id: upload-throttle-ip
    content: "Harden getClientIp for anonymous upload rate limits (trusted proxy hop) so staging abuse cannot rotate XFF forever"
    status: cancelled
  - id: path-and-secret-hardening
    content: "Reject staged path traversal explicitly; prefer dedicated CREDIT_FUNDING_SIGNING_SECRET over encryption/auth fallbacks in prod docs"
    status: completed
  - id: tests
    content: "Add focused tests for staging cleanup helpers, client-files path ownership, and staged path validation"
    status: completed
isProject: false
---

# Area 09 - Deep Dive + Fix Plan

**Status:** implemented and verified
**Priority:** P2
**Scope:** File uploads, signed upload sessions, storage path trust, download signed-URL minting, and related abuse/TTL controls.

---

## Summary

The Area 06 signed staged-file metadata design is solid: anonymous credit-funding uploads mint an HMAC session token, stage bytes through a server that validates size/MIME/magic bytes, then return a server-signed metadata token that intake re-verifies before moving objects out of `staging/`. Private buckets + auth-gated signed downloads are in place for credit-funding docs and client-files.

Remaining gaps are operational and defense-in-depth:

1. Staging object lifetime is not tied to the 24h token TTL (no cron cleanup).
2. Dashboard client-files JSON POST can attach another client's storage-path shape and later receive a signed URL.
3. Admin case-study / dispute-letter flows use direct `createSignedUploadUrl` without scanning uploaded bytes.
4. Anonymous upload throttles key on spoofable `x-forwarded-for`.

No SQL migration is required for the recommended fixes. No Supabase MCP production inspection was available; this plan is based on repo migrations and application code.

---

## Findings

### 1. Orphaned `staging/` objects never expire — High

Session tokens expire after 24h (`UPLOAD_SESSION_TTL_MS` in `credit-funding-upload-session.ts`), but staged storage objects are only deleted on successful intake via `removeStagedCreditFundingSession`. There is no `vercel.json` cron and no other cleanup of `staging/{sessionId}/`.

Abuse: anonymous `POST /api/credit-funding/stage` (30/hr/IP) can accumulate 4 MB files indefinitely if the caller never completes intake. Identity documents may also linger after abandoned applications.

**Fix direction**
- Add a protected cleanup route (cron + `CRON_SECRET`) that deletes staging objects older than the session TTL.
- Also purge staging on intake failure / rollback paths, not only success.

### 2. Dashboard files JSON branch trusts path shape, not ownership — Medium

`POST /api/dashboard/files` multipart path uploads into `{clientId}/...` correctly. The JSON branch accepts any `file_url` that matches the client-files path regex and stores it on the caller's `client_id` row. Later `withSignedClientFileUrls` signs whatever path is stored.

Exploitability is limited because object names include random UUIDs (not enumerable), but this is still a tenant isolation hole.

**Fix direction**
- Require resolved path to start with `${clientId}/`, or delete the JSON branch and keep multipart only.

### 3. Spoofable IP for anonymous upload throttles — disproven for Vercel

`getClientIp` returns the first `x-forwarded-for` hop. Current Vercel documentation confirms that Vercel overwrites this header and does not forward an external value, specifically to prevent spoofing (unless an Enterprise trusted proxy is explicitly enabled). This deployment does not need a code change.

**Resolution**
- Keep the platform-provided `x-forwarded-for` value. Durable Upstash limits remain in place.

### 4. Admin signed-upload-URL flows skip byte scanning — Medium

Case studies and dispute letters mint `createSignedUploadUrl` after declared content-type/size checks. Bytes never pass through `scanFileBuffer`. Case studies can become public URLs after finalize; dispute letters stay private but are still trusted inputs to analysis.

**Fix direction**
- After upload (before publish/analyze), download the object and run magic-byte/PE scan; reject and delete on failure. Split public-PDF abuse notes with Area 11.

### 5. Staged path `startsWith` without explicit `..` rejection — Low

HMAC prevents client-forged paths today, but `verifyStagedFileMetadataToken` should reject `..` / normalized path escapes as belt-and-suspenders.

### 6. Signing secret fallback chain reuses encryption/auth secrets — Low

`getCreditFundingSigningSecret` can fall back to `CREDIT_FUNDING_ENCRYPTION_KEY` or `NEXTAUTH_SECRET`. Prefer a dedicated `CREDIT_FUNDING_SIGNING_SECRET` in production (ops/docs; overlaps Areas 03/08).

---

## Already solid (do not invent work)

- HMAC upload session + per-file metadata tokens with expiry, session binding, timing-safe verify.
- Server-owned `scan_status: 'clean'` inside signed metadata (Area 06 fix).
- Magic-byte + PE rejection on credit-funding stage and client-files multipart uploads.
- Private buckets (`credit-funding-docs`, `client-files` after 017, `dispute-letters`) and signed-URL downloads behind auth.
- Server-generated `randomUUID` object names + `sanitizeStorageFileName`.
- Applicant access excludes staff roles and binds `user_id` once.

---

## Implementation plan (after approval)

1. **Staging TTL cleanup** — `credit-funding-storage.ts` helper to list/delete old `staging/` objects; `api/internal/cleanup-staging` (or cron route) gated by `CRON_SECRET`; `vercel.json` cron; intake rollback also calls session remove.
2. **Client-files ownership** — `resolveClientFileStoragePathForClient(fileUrl, clientId)` and enforce in dashboard JSON POST; prefer removing JSON branch if unused.
3. **Signed-upload byte scan** — post-upload verify for case studies before public finalize; same for dispute letters before analyze.
4. **IP throttle hardening** — tighten `getClientIp` for Vercel; keep durable limits.
5. **Path/secret hardening** — reject `..` in staged path validation; document dedicated signing secret.
6. **Tests** — ownership reject/accept cases; staged path traversal reject; cleanup helper age filter if mockable.

---

## Acceptance criteria

- [x] Staging objects older than session TTL are deleted by a scheduled, secret-gated job.
- [x] Failed/abandoned intake paths do not leave staging forever when session id is known.
- [x] Dashboard cannot mint a signed URL for another client's vault path via the JSON file POST.
- [x] Case-study and dispute-letter usable/published objects have been magic-byte scanned after upload.
- [x] Staged metadata paths containing `..` are rejected.
- [x] Focused tests + typecheck/build pass.

## Implementation verification

- Added a daily Vercel Cron route protected by `CRON_SECRET`; the production secret is configured.
- Confirmed production already has a dedicated `CREDIT_FUNDING_SIGNING_SECRET`.
- Full unit suite: 72 passed.
- `npm run typecheck` and `npm run build` pass. Build retains pre-existing image/useMemo warnings in credit-funding UI files.

---

## Deferred / overlap

- **Area 07:** durable rate limits already expanded; IP spoofing hardening is the remaining throttle angle for uploads.
- **Area 08:** object-at-rest encryption for identity docs beyond private storage is out of scope here; signing-secret reuse note only.
- **Area 11:** public case-study PDF surface after publish — keep scanning here, public-abuse review there.
- **Area 10:** no Stripe overlap.
- Opaque/randomized display filenames for credit-funding docs (noted in Area 08): optional polish if still sensitive in admin UI; not blocking for this area.
