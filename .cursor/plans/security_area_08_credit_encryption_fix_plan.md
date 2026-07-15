---
name: "Area 08 Fix Plan - Credit-Funding Sensitive Data Encryption Coverage"
overview: "Credit-funding intake encrypts many high-risk fields, and production has CREDIT_FUNDING_ENCRYPTION_KEY configured. The main remaining risks are broad admin decryption, plaintext free-text/message fields, plaintext invitation phone values, and list/query paths fetching more encrypted secrets than they need."
todos:
  - id: admin-secret-reveal
    content: "Stop returning SSN/passwords in the normal admin detail payload; add explicit reveal endpoints with audit logging"
    status: pending
  - id: free-text-encryption
    content: "Encrypt credit-funding messages, status notes, document request notes, and staff/client workflow notes at rest"
    status: pending
  - id: list-query-minimization
    content: "Replace broad select('*') list paths with explicit summary/detail selects"
    status: pending
  - id: invitation-phone
    content: "Encrypt phone and placeholder sensitive fields on staff-created invitation rows"
    status: pending
  - id: ciphertext-format
    content: "Add a versioned ciphertext prefix/key-id format while preserving legacy decrypt fallback"
    status: pending
  - id: tests
    content: "Add focused encryption coverage tests for create/update/read formatting and secret reveal behavior"
    status: pending
isProject: false
---

# Area 08 - Deep Dive + Fix Plan

**Status:** plan-ready (awaiting permission to implement)
**Priority:** P1
**Scope:** Credit-funding PII and sensitive data at rest, in API payloads, and in admin/client presentation.

---

## Summary

The credit-funding flow already has meaningful app-layer encryption:

- `field-encryption.ts` uses AES-256-GCM and requires `CREDIT_FUNDING_ENCRYPTION_KEY` in production.
- Production Vercel env includes `CREDIT_FUNDING_ENCRYPTION_KEY`.
- Intake creation uses `buildEncryptedApplicationRow`, encrypting SSN, DOB, phone, address, credit-provider credentials, Experian credentials, CFPB credentials, free-form goals notes, typed signature, income values, and sensitive business contact/EIN fields.
- RLS is enabled with no direct anon/authenticated policies for credit-funding tables; Next.js server routes use the service-role client.
- Applicant dashboard API returns a narrow non-secret application shape.
- CSV export masks email/phone rather than exporting full contact details.

I could not inspect live Supabase table metadata through MCP because the connected Supabase MCP user still does not have permission for the production project. This plan is based on repository migrations and application code.

---

## Findings

### 1. Admin detail payload decrypts and returns all secrets by default - High

`formatApplicationForAdmin(app)` calls `decryptApplicationSensitiveFields(app)` and returns SSN, DOB, portal usernames, provider passwords, Experian password, CFPB password, address, typed signature, credit profile income, and decrypted business profile in one payload whenever an MFA-verified credit-funding staff member opens an application detail.

The UI then renders the password and SSN values directly in the detail view. MFA helps, but this still maximizes exposure to browser memory, logs, extensions, screenshots, and accidental shoulder-surfing.

**Fix:**

- Split admin formatting into:
  - default detail payload: decrypted contact/address/business summary as needed, but secrets masked/redacted.
  - explicit reveal endpoint: `POST /api/admin/credit-funding/[id]/reveal-sensitive` or similar for specific fields (`ssn`, `provider_password`, `experian_password`, `cfpb_password`, etc.).
- Require `requireCreditFundingStaffSession()` and MFA, validate requested field allowlist, rate limit reveals, and log each reveal with field name and actor.
- UI should show masked values by default and require a deliberate "Reveal" action per field.

### 2. Free-text communication/workflow fields are plaintext at rest - High

The following tables/columns store user/staff-entered text without encryption:

- `credit_funding_messages.text`
- `credit_funding_status_history.notes`
- `credit_funding_document_requests.notes`
- `credit_funding_applications.internal_notes`
- `credit_funding_applications.client_notes`
- `credit_funding_applications.next_steps`
- `credit_funding_applications.invite_personal_message`

These fields can easily contain SSNs, account credentials, addresses, bank/document details, or funding-sensitive context. RLS limits direct access, but a database dump, service-role misuse, or accidental export still exposes the text.

**Fix:**

- Add encrypted sibling columns where needed or store encrypted values in existing text columns with legacy fallback.
- Prefer helper functions like `encryptCreditFundingMessageForDb`, `decryptCreditFundingMessageForView`, `encryptApplicationNotesForDb`, and `decryptApplicationNotesForView`.
- Keep legacy fallback for existing plaintext records, then add a migration/backfill script to rewrite historical values.

### 3. List/query paths fetch too much sensitive data - Medium

`getCreditFundingApplications()` uses `select('*')` for admin lists, export, bulk notifications, and search. That pulls encrypted SSN/password/DOB/business profile fields into memory even for views that only need summary fields and phone. The admin list formatter also decrypts the whole application just to return phone.

**Fix:**

- Introduce explicit select constants:
  - `CREDIT_FUNDING_LIST_SELECT`: summary fields plus encrypted phone only.
  - `CREDIT_FUNDING_DETAIL_SELECT`: full detail only when needed.
  - document/message/history selects where appropriate.
- Make `formatApplicationListItemForAdmin` decrypt only phone, not the full sensitive application.
- Adjust export to decrypt phone before masking, because `maskPhone(a.phone)` currently masks encrypted blobs incorrectly for encrypted rows.

### 4. Staff-created invitation rows store phone/plain placeholders unencrypted - Medium

`createInvitedCreditFundingApplication()` writes staff-entered phone directly to `phone`, and writes placeholder values like `address`, `city`, `zip_code`, and `typed_signature` as plaintext. The final submitted application path later encrypts these, but pending invitation rows can sit in the database with plaintext phone numbers.

**Fix:**

- Use the same field-encryption helpers for invitation rows.
- Store phone with `encryptFieldIfPresent(phone) || encryptField(INVITE_PLACEHOLDER)`.
- Store placeholder address/city/zip/signature encrypted or use nullable columns where constraints permit.
- Ensure invite validation and admin list views still use `decryptFieldOrLegacy`.

### 5. Ciphertext has no explicit version/key marker - Medium

Encrypted values are stored as raw base64 of `iv + tag + ciphertext`. `decryptFieldOrLegacy` guesses whether a value is encrypted based on base64 shape. This works for compatibility, but it makes key rotation and format evolution harder and can misclassify unusual plaintext.

**Fix:**

- Introduce a new format like `enc:v1:<base64>` for newly encrypted values.
- Keep current raw-base64 decrypt support as legacy.
- Add `isEncryptedField(value)` and tests for plaintext/base64-like legacy edge cases.
- Leave room for future key IDs, e.g. `enc:v1:k1:<base64>`, if rotation is needed.

### 6. Document metadata and storage paths may preserve sensitive filenames - Medium/Low

Document upload paths include sanitized original filenames after a UUID. If a user uploads `john_ssn_1234.pdf`, the sensitive portion persists in `storage_path`, `file_name`, signed URL paths, and admin/client views.

**Fix:**

- Generate opaque object names using UUID plus extension only.
- Store a sanitized display title separately, and consider warning users not to include secrets in filenames.
- If existing filenames are sensitive, add a storage rename/backfill plan. This overlaps with Area 09 uploads, but the metadata exposure belongs in Area 08.

---

## Implementation Plan

### Step 1 - Minimize admin default decryption

- Replace `formatApplicationForAdmin` with a safe-by-default formatter.
- Add `formatApplicationSensitiveReveal` or a reveal route for explicit secret access.
- Mask SSN/password fields by default in the admin page.
- Add audit events for reveal actions.

### Step 2 - Encrypt free-text fields

- Add encryption/decryption helpers for messages, status history, document requests, and application workflow notes.
- Encrypt on create/update:
  - `createCreditFundingMessage`
  - `createStatusHistory`
  - `createDocumentRequest`
  - `updateCreditFundingApplication`
  - `extendApplicationInvitation`
- Decrypt on read for authorized admin/applicant views.

### Step 3 - Reduce broad selects

- Add explicit select constants in `credit-funding-db.ts`.
- Use summary selects for lists/export/bulk notification paths.
- Keep full select only for detail/reveal flows.
- Fix CSV export phone masking to decrypt then mask.

### Step 4 - Encrypt invitation rows consistently

- Update `createInvitedCreditFundingApplication` to encrypt phone and placeholder sensitive fields.
- Keep lookup by email plaintext for now because invitation lookup depends on it.
- Add tests proving invite phone is encrypted and admin list formatting still displays/masks correctly.

### Step 5 - Version ciphertext

- Update `encryptField` to emit a versioned prefix for new writes.
- Update `decryptField` and `decryptFieldOrLegacy` to support both versioned and legacy raw-base64 ciphertext.
- Add malformed/legacy/base64-looking plaintext tests.

### Step 6 - Tests and verification

- Add focused tests for:
  - new ciphertext prefix and legacy decrypt compatibility.
  - free-text write/read encryption behavior.
  - safe admin detail payload excludes raw SSN/passwords.
  - reveal route returns only requested fields and logs reveal attempts.
  - list formatter does not call full sensitive decrypt.
- Run `npm run typecheck`, focused tests, and `npm run build`.

---

## Success Criteria

- [ ] Opening an admin application detail no longer returns SSN/passwords by default.
- [ ] Sensitive fields can be revealed only through a deliberate audited endpoint.
- [ ] Credit-funding messages/notes/request notes are encrypted at rest with legacy read fallback.
- [ ] Admin list/export paths avoid broad `select('*')` and do not fetch credential/SSN columns.
- [ ] Pending invitation rows no longer store phone numbers in plaintext.
- [ ] New ciphertext is versioned while old ciphertext remains readable.
