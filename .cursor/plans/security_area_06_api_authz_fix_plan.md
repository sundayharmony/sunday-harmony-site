---
name: "Area 06 Fix Plan — API Authorization + IDOR Hardening"
overview: "The API audit found no broad public data exposure or obvious client-to-client IDOR. Fixes are targeted: one credit-funding staff route bypasses the MFA-enforcing helper, staged credit-funding upload metadata trusts client JSON, applicant access can bind by email alone, and several dashboard routes duplicate auth boilerplate instead of the shared client helper."
todos:
  - id: staff-mfa-gap
    content: "Replace raw getServerSession in admin credit-funding notification route with MFA-enforcing staff helper"
    status: completed
  - id: staged-upload-metadata
    content: "Stop trusting client-supplied staged-file metadata/scan_status during credit-funding intake"
    status: completed
  - id: applicant-binding
    content: "Harden applicant credit-funding access: staff exclusion + one-time user_id binding"
    status: completed
  - id: client-helper-refactor
    content: "Migrate duplicated dashboard auth checks to requireClientSession"
    status: completed
  - id: tests
    content: "Add focused authz tests for MFA gap, staged metadata, document type validation, and client helper behavior"
    status: completed
isProject: false
---

# Area 06 — Deep dive + fix plan

**Status:** implemented and verified
**Priority:** P1
**Scope:** API authorization and IDOR risks across `src/app/api/**`.

---

## Summary

I audited the API surface in three groups: admin APIs, dashboard/client APIs, and public/billing/invite APIs. The overall shape is solid:

- Admin APIs mostly use `requireAdminSession`, `requireStaffSession`, or `requireCreditFundingStaffSession`, which now include staff MFA enforcement.
- Dashboard APIs generally derive `clientId`, `userId`, or credit-funding application access from the session rather than trusting request bodies.
- Billing APIs funnel through `authorizeBillingClient`.
- Stripe webhook verifies signatures and is idempotent.
- Password reset/setup/contact/public case-study routes are intentionally public or token-gated.

No “any client can read any other client” IDOR was found. The main work is closing a few authz drift gaps and consolidating repeated checks.

---

## Findings

### 1. Admin credit-funding notification route bypasses the MFA-enforcing helper — High

```15:18:src/app/api/admin/credit-funding/send-notifications/route.ts
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'credit_manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```

This route sends client and expert notification emails for all submitted credit-funding applications and decrypts applicant phone numbers for expert notifications. It checks role manually but does **not** use `requireCreditFundingStaffSession`, so a staff session that is not MFA verified can still hit it.

**Fix:** replace raw `getServerSession` with `requireCreditFundingStaffSession()` and return the helper response when unauthorized/MFA-required.

### 2. Credit-funding intake trusts client-supplied staged file metadata — Medium

```188:197:src/app/api/credit-funding/intake/route.ts
        await createUploadedDocument({
          application_uuid: application.id,
          document_type: staged.documentType,
          file_name: finalized.data.displayName,
          file_type: finalized.data.file_type,
          file_size: finalized.data.file_size,
          storage_path: finalized.data.storagePath,
          mime_type: finalized.data.mime_type,
          scan_status: finalized.data.scan_status,
        })
```

The staged upload flow validates the signed upload session and storage path, but `stagedFiles` is JSON supplied by the browser. `finalizeStagedCreditFundingDocument` copies `file_size`, `file_type`, `mime_type`, `file_name`, and especially `scan_status` from that JSON after moving the object. A caller with a valid upload session can spoof `scan_status: "clean"` or misleading metadata.

**Fix:** make finalized metadata server-derived. At minimum:

- Validate `staged.documentType` against `DOCUMENT_TYPES`.
- Derive display/file type from the staged object path/name, not arbitrary JSON.
- Mark finalized staged records with server-owned scan status only. If the staging upload already scanned the file, return a signed server-side metadata token from `/api/credit-funding/stage`; otherwise set staged finalization to `pending`/`unscanned` and avoid trusting request JSON.

### 3. Dashboard credit-funding upload accepts unvalidated `documentType` — Medium

```24:39:src/app/api/dashboard/credit-funding/upload/route.ts
    const documentType = formData.get('documentType') as string
    // ...
      documentType: documentType as DocumentType,
```

`documentType` is cast to `DocumentType` without allowlist validation. It is later used in storage paths and DB records. This is scoped to the applicant’s own application, so it is not cross-tenant traversal, but it pollutes records and creates odd storage paths.

**Fix:** reject values not in `DOCUMENT_TYPES` (or the intended applicant-upload subset) before calling `uploadCreditFundingDocument`.

### 4. Applicant credit-funding access can bind by email alone — Medium

```28:30:src/lib/credit-funding-dashboard-auth.ts
  const byUser = await getCreditFundingApplicationByUserId(userId)
  const application = byUser || (await getCreditFundingApplicationByEmail(email))
```

If an application has no `user_id`, the dashboard grants access to any logged-in user with a matching email. If signup email ownership is not verified, this is an account-takeover style binding risk. The helper also blocks only `admin`, not `credit_manager`, even though both are staff roles.

**Fix:** block all staff roles, and on a successful email fallback immediately persist `user_id`/`client_id` to the application. Longer-term, require email verification or a signed claim/link step before email fallback is accepted.

### 5. Dashboard meetings route has inline auth without role check — Low

```9:17:src/app/api/dashboard/meetings/route.ts
  const session = await getServerSession(authOptions)
  // ...
  const clientId = (session.user as { clientId?: string }).clientId
```

It checks session + `clientId`, but not `role === 'client'`. This is unlikely to be exploitable today because staff sessions normally do not carry `clientId`, but it is inconsistent with sibling dashboard routes.

**Fix:** use `requireClientSession()` + `getClientIdFromSession()`.

### 6. Dashboard routes duplicate client auth checks — Low / maintainability

Several routes reimplement the same client session/role/clientId checks that already exist in `src/lib/client-auth.ts`:

- `src/app/api/dashboard/files/route.ts`
- `src/app/api/dashboard/approvals/route.ts`
- `src/app/api/dashboard/notifications/route.ts`
- `src/app/api/dashboard/settings/route.ts`
- `src/app/api/dashboard/billing/invoices/route.ts`

The duplicated pattern is mostly correct, but this is how finding 5 happened.

**Fix:** migrate these to `requireClientSession()` and `getClientIdFromSession()` while preserving their existing ID ownership checks.

### 7. Dashboard activity endpoint returns `select('*')` — Info

```18:23:src/app/api/dashboard/activity/route.ts
    const { data, error } = await getSupabase()
      .from('activity_log')
      .select('*')
      .eq('entity_id', access.clientId)
```

It is filtered by client ID, so this is not IDOR. But full activity rows may include internal actor identifiers or details better kept out of the client portal.

**Fix:** select an explicit allowlist of fields.

---

## Implementation Plan

### Step 1 — Close the concrete MFA gap

- Update `src/app/api/admin/credit-funding/send-notifications/route.ts` to use `requireCreditFundingStaffSession`.
- Add/extend an authz test proving MFA-pending staff receives `403 MFA_REQUIRED`.

### Step 2 — Harden credit-funding document authorization/metadata

- Add a shared `isDocumentType(value): value is DocumentType` helper in `credit-funding-types.ts`.
- Use it in:
  - `src/app/api/credit-funding/stage/route.ts`
  - `src/app/api/credit-funding/intake/route.ts`
  - `src/app/api/dashboard/credit-funding/upload/route.ts`
- Change staged finalization so `scan_status` is server-owned rather than request-owned. Prefer a small server-signed staged-file metadata token if preserving exact staged metadata is needed.

### Step 3 — Harden applicant binding

- In `requireApplicantCreditFundingAccess`, reject any staff role via `isStaffRole`.
- If access falls back to email match and the application has no `user_id`, call `linkApplicationToUser` before returning success.
- Keep a TODO/plan note that true email-verification enforcement belongs with auth/account lifecycle if not currently available.

### Step 4 — Consolidate dashboard auth helpers

- Convert the duplicated client routes to `requireClientSession`.
- Keep existing ownership checks for IDs (`file.client_id`, `approval.client_id`, `notification.user_id`, etc.).
- Update meetings route in the same pass.

### Step 5 — Narrow activity log output

- Replace `select('*')` with an explicit client-safe column list.

### Step 6 — Tests and verification

- Add focused unit tests for:
  - admin notification route requires MFA-verified staff helper.
  - document type guard rejects bad values.
  - staged metadata cannot force a trusted `scan_status`.
  - `requireApplicantCreditFundingAccess` blocks staff and links by user ID after fallback.
- Run `npm run typecheck`.
- Run focused tests; do not rely on the full unit suite because it still hangs in this repo.

---

## Success Criteria

- [x] Every `/api/admin/credit-funding/**` route uses the MFA-aware staff helper where staff access is required.
- [x] No staged credit-funding finalization trusts browser-supplied `scan_status`.
- [x] Applicant dashboard access is never granted to staff and binds unclaimed applications to the current user.
- [x] Dashboard client routes consistently use `requireClientSession`.
- [x] ID ownership checks remain in place for file/approval/notification/document mutations.

---

## Implementation Notes

- Staged upload metadata is authenticated with an expiring HMAC token bound to the upload session, document type, storage path, file metadata, and server-owned clean scan result.
- Applicant document types now pass through a shared runtime allowlist guard before reaching storage or database code.
- Email fallback can claim only an unbound application; the database update is conditional on `user_id IS NULL` to prevent concurrent or later reassignment.
- General dashboard routes now share one client-role/client-ID policy. Existing file, approval, and notification ownership checks remain in place.
- Activity responses expose only `id`, `action`, `entity_type`, `details`, and `created_at`.
- Focused Area 06 tests: 10 passed. `npm run typecheck` and `npm run build` also passed.
- A stronger signed claim or verified-email requirement remains a future account-lifecycle enhancement if self-service account creation is introduced.
