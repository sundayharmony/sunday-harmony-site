# Sunday Harmony Site — Bug Audit Report
## 265 Bugs Found, Categorized and Prioritized

**Date:** March 29, 2026
**Audited by:** Claude AI
**Project:** sundayharmony.com (Next.js 14 App Router)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 18 |
| High | 78 |
| Medium | 112 |
| Low | 57 |
| **Total** | **265** |

---

## CRITICAL BUGS (18)

### C1. Truncated file: `[...nextauth]/route.ts`
**File:** `src/app/api/auth/[...nextauth]/route.ts` (Line 6)
Missing NextAuth handler export. File ends at line 6 without exporting GET/POST handlers.
**Fix:** Complete the file with proper NextAuth handler and exports.

### C2. Truncated file: `forgot-password/route.ts`
**File:** `src/app/api/auth/forgot-password/route.ts` (Line 88)
Missing final return statement. Function ends mid-response.
**Fix:** Add success response and closing braces.

### C3. Truncated file: `reset-password/route.ts`
**File:** `src/app/api/auth/reset-password/route.ts` (Line 75)
Incomplete return statement: `NextResponse.json({ s` — cut off mid-object.
**Fix:** Complete the success response, closing braces, and export.

### C4. Truncated file: `db.ts`
**File:** `src/lib/db.ts` (Line 493)
`updateApproval()` function cuts off at `if (erro` in error handling. Missing: seedAdmin export, closing braces.
**Fix:** Complete updateApproval, add seedAdmin function.

### C5. Truncated file: `admin/messages/route.ts`
**File:** `src/app/api/admin/messages/route.ts` (Line 110)
POST handler ends with incomplete catch block.
**Fix:** Complete error handler and closing braces.

### C6. Truncated file: `admin/clients/route.ts`
**File:** `src/app/api/admin/clients/route.ts` (Line 170)
PATCH handler ends mid-function during logActivity call.
**Fix:** Complete logActivity call, add return statement and closing braces.

### C7. Truncated file: `contact/route.ts`
**File:** `src/app/api/contact/route.ts` (Line 144)
Catch block starts but ends with incomplete `console.error` at line 144.
**Fix:** Complete error handling and add closing braces.

### C8. Truncated file: `dashboard/messages/route.ts`
**File:** `src/app/api/dashboard/messages/route.ts` (Line 96)
Catch block ends incomplete at `console.e`.
**Fix:** Complete error handler and closing braces.

### C9. Truncated file: `dashboard/settings/route.ts`
**File:** `src/app/api/dashboard/settings/route.ts` (Line 115)
Catch block starts but ends with partial console.error call.
**Fix:** Complete error handler and closing braces.

### C10. Missing `seedAdmin` function
**File:** `src/lib/db.ts`
Function imported in `auth.ts` and `setup/route.ts` but never defined/exported in db.ts.
**Fix:** Implement seedAdmin function that creates default admin user.

### C11. Incomplete `StatCard` component
**File:** `src/components/ui/StatCard.tsx` (Line 18)
Missing closing JSX tags and return statement completion.
**Fix:** Complete the component with proper JSX structure.

### C12. No authentication guard on dashboard layout
**File:** `src/app/dashboard/layout.tsx` (Line 1-20)
Layout wraps children in SessionProvider without checking if user is authenticated. Any unauthenticated user can access dashboard routes.
**Fix:** Add `getServerSession` check and redirect to login if unauthenticated.

### C13. No authentication guard on admin layout
**File:** `src/app/admin/layout.tsx` (Line 1-16)
No guard to prevent non-admin users from accessing admin routes.
**Fix:** Add server-side session check with admin role verification.

### C14. Role-based redirect bypasses middleware
**File:** `src/app/login/page.tsx` (Line 37-40)
Uses `window.location.href` for role-based redirects instead of Next.js router, bypassing middleware protection.
**Fix:** Use `router.push()` instead of `window.location.href`.

### C15. Open redirect vulnerability in NotificationBell
**File:** `src/components/ui/NotificationBell.tsx` (Line 111)
`window.location.href` set from user-controlled notification link data without validation.
**Fix:** Validate URL before navigation, ensure it's a relative path or whitelisted domain.

### C16. Storing loginPassword in client-side state
**File:** `src/app/admin/clients/page.tsx` (Line 27)
Password stored in React state and potentially sent in PATCH requests.
**Fix:** Only include password in initial creation POST, never in updates.

### C17. Div with onClick used as interactive element (NotificationBell)
**File:** `src/components/ui/NotificationBell.tsx` (Line 111)
Div element with onClick handler should be a button for keyboard accessibility — WCAG violation.
**Fix:** Replace div with button or add role="button", tabIndex, and keyboard event handlers.

### C18. Div with onClick used as interactive element (ClientSidebar)
**File:** `src/components/dashboard/ClientSidebar.tsx` (Line 47)
Backdrop div with onClick used as interactive element without keyboard accessibility.
**Fix:** Add role="button", tabIndex={0}, and onKeyDown handler.

---

## HIGH SEVERITY BUGS (78)

### H1–H7: Missing try-catch blocks
- **H1.** `admin/data/route.ts` PATCH handler (Line 22-35) — no error handling for request.json() or updateAdminData()
- **H2.** `admin/clients/route.ts` PATCH handler (Line 144-171) — unprotected async/await calls
- **H3.** `setup/route.ts` (Line 46) — seedAdmin() called without try-catch
- **H4.** `admin/data/route.ts` PATCH (Line 22-35) — missing auth check, only verifies session exists, not admin role
- **H5.** `dashboard/activity/route.ts` (Line 40) — silent catch returns empty array instead of 500 error
- **H6.** `admin/approvals/route.ts` (Line 50) — unsafe JSON parsing, request.json() not try-caught
- **H7.** `contact/route.ts` (Line 27) — unsafe JSON parsing without try-catch

### H8–H12: Security vulnerabilities
- **H8.** `admin/clients/route.ts` (Line 125) — Password sent in plaintext email
- **H9.** `rate-limit.ts` (Line 1-3) — In-memory rate limiting won't work with multiple instances
- **H10.** `next.config.js` (Line 26) — CSP allows unsafe-inline and unsafe-eval
- **H11.** `auth/forgot-password/route.ts` (Line 36) — Weak 6-digit verification code (only 900K values)
- **H12.** `setup/route.ts` (Line 38-44) — Token comparison vulnerable to timing attacks

### H13–H18: Missing input validation
- **H13.** `admin/clients/route.ts` (Line 36) — No password strength validation on user creation
- **H14.** `contact/route.ts` (Line 51-59) — Doesn't check trimmed values are non-empty
- **H15.** `reset-password/route.ts` (Line 35-39) — Insufficient password validation (no special chars)
- **H16.** `admin/files/page.tsx` (Line 93) — No file size validation (allows negative/huge sizes)
- **H17.** `admin/files/page.tsx` (Line 93) — No file type whitelist validation
- **H18.** `admin/files/page.tsx` (Line 93) — No URL format validation for file_url

### H19–H26: Missing form validation / double-submit prevention
- **H19.** `admin/approvals/page.tsx` (Line 96) — No loading state on addApproval button
- **H20.** `admin/clients/page.tsx` (Line 92) — No loading/disabled on addClient submit
- **H21.** `admin/files/page.tsx` (Line 262) — No loading state on addFile button
- **H22.** `admin/tasks/page.tsx` (Line 319) — No loading state on Create Task button
- **H23.** `admin/clients/page.tsx` (Line 73) — Missing email format validation before submit
- **H24.** `admin/leads/page.tsx` (Line 42) — Missing email validation in updateLead
- **H25.** `admin/tasks/page.tsx` (Line 93) — Missing form validation before task submit
- **H26.** `admin/settings/page.tsx` (Line 59) — Weak password regex validation

### H27–H32: Race conditions
- **H27.** `rate-limit.ts` (Line 19-38) — Simultaneous requests can both pass rate limit
- **H28.** `admin/competitors/page.tsx` (Line 50) — updateCanvas doesn't wait for previous save
- **H29.** `admin/clients/page.tsx` (Line 54) — Rapid updates cause state inconsistency
- **H30.** `admin/messages/page.tsx` (Line 115) — Optimistic update without proper error recovery
- **H31.** `admin/approvals/page.tsx` (Line 136) — Rapid dropdown changes trigger concurrent requests
- **H32.** `admin/research/page.tsx` (Line 36) — toggleTask triggers immediate save without debounce

### H33–H38: CSRF protection missing
- **H33.** `admin/competitors/page.tsx` (Line 19) — No CSRF token on data fetch
- **H34.** `admin/clients/page.tsx` (Line 56) — No CSRF token on PATCH request
- **H35.** `admin/leads/page.tsx` (Line 44) — No CSRF token on PATCH request
- **H36.** `admin/approvals/page.tsx` (Line 103) — No CSRF token on POST request
- **H37.** `admin/messages/page.tsx` (Line 116) — No CSRF token on POST request
- **H38.** `admin/settings/page.tsx` (Line 71) — No CSRF on password change

### H39–H44: Missing error handling in email
- **H39.** `admin/clients/route.ts` (Line 85-139) — Missing error handling for sendMail()
- **H40.** `admin/messages/route.ts` (Line 84) — sendMail .catch() doesn't prevent success response
- **H41.** `contact/route.ts` (Line 85-109) — Response sent before email confirmed
- **H42.** `dashboard/messages/route.ts` (Line 76) — sendMail .catch() doesn't prevent success
- **H43.** `admin/clients/route.ts` (Line 94) — Missing await on sendMail() — fire-and-forget
- **H44.** `admin/approvals/route.ts` (Line 84) — Missing await on sendMail()

### H45–H56: Missing AbortController cleanup in useEffect
- **H45.** `admin/clients/page.tsx` (Line 37-52) — async useEffect no abort mechanism
- **H46.** `admin/approvals/page.tsx` (Line 58-73) — no AbortController
- **H47.** `admin/approvals/page.tsx` (Line 76-94) — no AbortController
- **H48.** `admin/files/page.tsx` (Line 73-91) — no AbortController
- **H49.** `admin/messages/page.tsx` (Line 52-60) — setInterval never cleared on unmount
- **H50.** `admin/tasks/page.tsx` (Line 73-91) — no AbortController
- **H51.** `dashboard/onboarding/page.tsx` (Line 34-64) — no AbortController
- **H52.** `dashboard/billing/page.tsx` (Line 80-85) — no AbortController
- **H53.** `dashboard/performance/page.tsx` (Line 58-74) — no AbortController
- **H54.** `dashboard/package/page.tsx` (Line 89-94) — no AbortController
- **H55.** `admin/competitors/page.tsx` (Line 18-27) — no abort + silent error catch
- **H56.** `dashboard/messages/page.tsx` (Line 23-28) — setInterval never cleared

### H57–H63: Unsafe data display / XSS
- **H57.** `admin/messages/page.tsx` (Line 248) — whitespace-pre-wrap displays user text without sanitization
- **H58.** `admin/approvals/page.tsx` (Line 379) — Unsafe href from content_url without validation
- **H59.** `admin/files/page.tsx` (Line 313) — Unsafe href from file_url without validation
- **H60.** `admin/clients/page.tsx` (Line 149) — CSV export without sanitization (XSL injection)
- **H61.** `admin/leads/page.tsx` (Line 77) — CSV export without input sanitization
- **H62.** `ContactForm.tsx` (Line 30) — Form submission without CSRF token
- **H63.** `admin/tasks/page.tsx` (Line 144) — deleteTask uses window.confirm (blocks UI)

### H64–H71: Missing error states / unhandled promise rejections
- **H64.** `admin/competitors/page.tsx` (Line 19-21) — fetch .catch() silently ignores errors
- **H65.** `admin/messages/page.tsx` (Line 52) — poll request doesn't set error state
- **H66.** `admin/page.tsx` (Line 10-11) — getLeads()/getClients() no try-catch in server component
- **H67.** `admin/leads/page.tsx` (Line 51) — CSV generation silently ignores errors
- **H68.** `reset-password/page.tsx` (Line 15-49) — Missing setLoading(false) on validation errors
- **H69.** `dashboard/onboarding/page.tsx` (Line 72) — Stale closure in updateData
- **H70.** `dashboard/page.tsx` (Line 82-84) — Unsafe array operations without validation
- **H71.** `page.tsx` (root) (Line 1) — Missing error boundary for complex component tree

### H72–H78: Auth / middleware issues
- **H72.** `auth.ts` (Line 64) — NEXTAUTH_SECRET not validated at runtime
- **H73.** `db.ts` (Line 16-19) — Missing error handling in verifyPassword (timing attack)
- **H74.** `middleware.ts` (Line 45-46) — Matcher config too broad, incomplete implementation
- **H75.** `auth/forgot-password/route.ts` (Line 39-42) — Reset tokens mixed with verification codes
- **H76.** `middleware.ts` (Line 37-38) — Admin redirect loop possible if role not in token
- **H77.** `rate-limit.ts` (Line 12-16) — Cleanup interval accumulates on module reload in dev
- **H78.** `admin/roadmap/page.tsx` (Line 36) — Missing debounce on toggle save

---

## MEDIUM SEVERITY BUGS (112)

### M1–M15: Missing null checks
- **M1.** `admin/approvals/route.ts` (Line 89-103) — clientUser.data could be null
- **M2.** `admin/tasks/route.ts` (Line 84-98) — clientUser could be falsy after .single()
- **M3.** `admin/files/route.ts` (Line 76-90) — sbClient.data could be undefined
- **M4.** `dashboard/files/route.ts` (Line 107-110) — file could be null in auth check
- **M5.** `dashboard/approvals/route.ts` (Line 60-62) — existing could be null
- **M6.** `dashboard/onboarding/route.ts` (Line 96) — social_accounts field unvalidated
- **M7.** `auth/reset-password/route.ts` (Line 44-49) — user could be null after .single()
- **M8.** `middleware.ts` (Line 6) — getToken result could be null, token.role could throw
- **M9.** `db.ts` (Line 236-246) — data.roadmap_tasks accessed without checking data exists
- **M10.** `dashboard/profile/route.ts` (Line 40-42) — Array.isArray() check after assignment
- **M11.** `dashboard/notifications/route.ts` (Line 52) — notification could be null
- **M12.** `dashboard/page.tsx` (Line 98) — String manipulation on user name without null check
- **M13.** `setup/route.ts` (Line 30) — SETUP_TOKEN check incomplete
- **M14.** `dashboard/billing/page.tsx` (Line 37-66) — startDate could be invalid
- **M15.** `dashboard/onboarding/page.tsx` (Line 41-46) — social_accounts could be undefined before spread

### M16–M24: Type safety issues
- **M16.** `admin/clients/route.ts` (Line 146) — Type assertion without null check
- **M17.** `admin/clients/route.ts` (Line 150) — Unsafe destructuring from req.json()
- **M18.** `auth.ts` (Line 40-46) — Unsafe type casting in JWT callback
- **M19.** `auth.ts` (Line 50-54) — Multiple unsafe casts in session callback
- **M20.** `db.ts` (Line 50-51) — Missing return type on getUserById
- **M21.** `dashboard/files/route.ts` (Line 99-122) — Missing type assertions
- **M22.** `admin/packages/page.tsx` (Line 32-34) — Type assertion without safety
- **M23.** `db.ts` (Line 354-357) — Null return type inconsistency
- **M24.** `admin/clients/route.ts` (Line 164) — Unsafe session.user role cast

### M25–M29: parseInt/env var issues
- **M25.** `admin/clients/route.ts` (Line 100) — parseInt(SMTP_PORT) could return NaN
- **M26.** `admin/messages/route.ts` (Line 79) — parseInt(SMTP_PORT) could return NaN
- **M27.** `contact/route.ts` (Line 77) — parseInt(SMTP_PORT) could return NaN
- **M28.** `dashboard/messages/route.ts` (Line 72) — parseInt(SMTP_PORT) could return NaN
- **M29.** `auth/forgot-password/route.ts` (Line 54) — parseInt(SMTP_PORT) could return NaN

### M30–M36: Missing input validation in API
- **M30.** `admin/data/route.ts` (Line 33) — No validation of update payload
- **M31.** `admin/leads/route.ts` (Line 23) — Unsafe destructuring from req.json()
- **M32.** `dashboard/onboarding/route.ts` (Line 68) — Unsafe JSON parsing
- **M33.** `dashboard/notifications/route.ts` (Line 38) — Unsafe JSON parsing
- **M34.** `contact/route.ts` (Line 27-28) — Missing service/industry validation
- **M35.** `contact/route.ts` (Line 87) — Missing NOTIFY_EMAIL validation
- **M36.** `admin/approvals/route.ts` (Line 50) — Missing content_type enum validation

### M37–M42: Database issues
- **M37.** `auth/reset-password/route.ts` (Line 48) — ilike() with user input could be slow
- **M38.** `db.ts` (Line 77-79) — updateUser mutates input object in-place
- **M39.** `db.ts` (Line 287-290) — limit parameter not validated for min/max
- **M40.** `db.ts` (Line 348-351) — createFileRecord doesn't validate client exists
- **M41.** `db.ts` (Line 385-388) — createTask doesn't validate client exists
- **M42.** `db.ts` (Line 414-415) — Chain query mutation issue

### M43–M68: Missing key props (26 instances)
- **M43.** `dashboard/approvals/page.tsx` (Line 193)
- **M44.** `dashboard/files/page.tsx` (Line 221)
- **M45.** `dashboard/package/page.tsx` (Line 183)
- **M46.** `dashboard/page.tsx` (Line 177) — index as key
- **M47.** `dashboard/page.tsx` (Line 205) — index as key
- **M48.** `dashboard/performance/page.tsx` (Line 142)
- **M49.** `dashboard/billing/page.tsx` (Line 180)
- **M50.** `dashboard/onboarding/page.tsx` (Line 249)
- **M51.** `admin/leads/page.tsx` (Line 148-150) — index as key for skeletons
- **M52.** `admin/clients/page.tsx` (Line 261) — index as key for skeletons
- **M53.** `admin/competitors/page.tsx` (Line 92-103) — index as key
- **M54.** `admin/discovery/page.tsx` (Line 32-67) — implicit index
- **M55.** `admin/discovery/page.tsx` (Line 77)
- **M56.** `admin/outreach/page.tsx` (Line 34)
- **M57.** `admin/outreach/page.tsx` (Line 70)
- **M58.** `admin/packages/page.tsx` (Line 21)
- **M59.** `admin/packages/page.tsx` (Line 60)
- **M60.** `admin/packages/page.tsx` (Line 126)
- **M61.** `admin/research/page.tsx` (Line 72)
- **M62.** `admin/research/page.tsx` (Line 150)
- **M63.** `admin/research/page.tsx` (Line 163)
- **M64.** `admin/revenue/page.tsx` (Lines 45, 70)
- **M65.** `admin/roadmap/page.tsx` (Lines 87, 128)
- **M66.** `admin/tasks/page.tsx` (Line 343)
- **M67.** `admin/approvals/page.tsx` (Line 212)
- **M68.** `admin/files/page.tsx` (Line 182)

### M69–M82: Missing AbortController (lower priority pages)
- **M69.** `admin/leads/page.tsx` (Line 25-40)
- **M70.** `admin/research/page.tsx` (Line 12-16)
- **M71.** `admin/roadmap/page.tsx` (Line 12-16)
- **M72.** `admin/outreach/page.tsx` (Line 10-14)
- **M73.** `admin/settings/page.tsx` (Line 25-40)
- **M74.** `dashboard/approvals/page.tsx` (Line 27-42)
- **M75.** `dashboard/files/page.tsx` (Line 26-41)
- **M76.** `dashboard/settings/page.tsx` (Line 26-41)
- **M77.** `dashboard/page.tsx` (Line 49-76)
- **M78.** `admin/tasks/page.tsx` (Line 55-70)
- **M79.** `dashboard/messages/page.tsx` (Line 57-65)
- **M80.** `admin/leads/page.tsx` (Line 199-211) — Array.from recreated every render
- **M81.** `admin/clients/page.tsx` (Line 308-319) — Pagination recreated every render
- **M82.** `dashboard/performance/page.tsx` (Line 96) — Hardcoded colors recreated per render

### M83–M92: Silent error handling / missing recovery
- **M83.** `admin/research/page.tsx` (Line 18) — No error recovery/retry
- **M84.** `admin/roadmap/page.tsx` (Line 12) — No error handling for fetch
- **M85.** `admin/research/page.tsx` (Line 13-15) — .catch(() => {}) swallows errors
- **M86.** `admin/roadmap/page.tsx` (Line 13-15) — .catch(() => {}) swallows errors
- **M87.** `admin/messages/page.tsx` (Line 20) — No debounce on poll requests
- **M88.** `admin/clients/page.tsx` (Line 52) — Missing optimistic update rollback
- **M89.** `admin/leads/page.tsx` (Line 51) — Missing optimistic update rollback
- **M90.** `admin/tasks/page.tsx` (Line 136) — Missing optimistic update rollback
- **M91.** `admin/leads/page.tsx` (Line 170) — State not reset when switching leads
- **M92.** `admin/clients/page.tsx` (Line 283) — Notes out of sync with server

### M93–M102: URL/link issues
- **M93.** `admin/clients/page.tsx` (Line 374) — URL not encoded for tasks link
- **M94.** `admin/clients/page.tsx` (Line 379) — URL not encoded for files link
- **M95.** `admin/clients/page.tsx` (Line 383) — URL not encoded for approvals link
- **M96.** `admin/approvals/page.tsx` (Line 84) — selectedClientId not URL encoded
- **M97.** `admin/files/page.tsx` (Line 81) — selectedClientId not URL encoded
- **M98.** `admin/tasks/page.tsx` (Line 81) — selectedClientId not URL encoded
- **M99.** `admin/approvals/page.tsx` (Line 153) — deleteApproval uses window.confirm
- **M100.** `login/page.tsx` (Line 32-33) — API call to endpoint that may not exist
- **M101.** `login/page.tsx` (Line 43-44) — Silent error handling in auth callback
- **M102.** `admin/page.tsx` (Line 97) — Incorrect package tier matching

### M103–M112: Miscellaneous medium
- **M103.** `db.ts` (Line 35-36) — console.log exposes database error details
- **M104.** `db.ts` (Line 205-214) — Inconsistent error handling (42P01 check)
- **M105.** `contact/route.ts` (Line 117-140) — DB error swallowed silently
- **M106.** `db.ts` (Line 285-292) — Missing pagination (no offset/cursor)
- **M107.** `rate-limit.ts` (Line 43-48) — getClientIp doesn't validate IP format
- **M108.** `next.config.js` (Line 23-34) — CSP built without directive validation
- **M109.** `package.json` (Line 10) — Windows-only PowerShell script in npm scripts
- **M110.** `Navbar.tsx` (Line 18) — document.body.style.overflow not SSR-safe
- **M111.** `admin/settings/page.tsx` (Line 50) — Weak password regex
- **M112.** `admin/clients/page.tsx` (Line 147) — Page doesn't reset search/filter on pagination

---

## LOW SEVERITY BUGS (57)

### L1–L10: Silent failures / missing logging
- **L1.** `admin/approvals/route.ts` (Line 95) — createNotification() error swallowed
- **L2.** `admin/tasks/route.ts` (Line 91) — createNotification() error swallowed
- **L3.** `admin/files/route.ts` (Line 83) — createNotification() error swallowed
- **L4.** `admin/clients/route.ts` (Line 57) — Missing error for unconfigured SMTP
- **L5.** `db.ts` (Line 271-282) — logActivity doesn't return error status
- **L6.** `db.ts` (Line 449-454) — markAllNotificationsRead doesn't check rows affected
- **L7.** `NotificationBell.tsx` (Line 52) — Silent empty catch block
- **L8.** `dashboard/performance/page.tsx` (Line 67-68) — catch swallows errors
- **L9.** `admin/activity/route.ts` (Line 14) — Inconsistent role check pattern
- **L10.** `admin/activity/route.ts` (Line 31) — Unprotected query without owner verification

### L11–L20: Missing body/result validation
- **L11.** `dashboard/approvals/route.ts` (Line 52-53) — Missing body validation
- **L12.** `dashboard/files/route.ts` (Line 52-53) — Missing body validation
- **L13.** `dashboard/notifications/route.ts` (Line 38-39) — Missing body validation
- **L14.** `admin/tasks/route.ts` (Line 51) — Missing request schema validation
- **L15.** `admin/approvals/route.ts` (Line 51) — Missing request schema validation
- **L16.** `admin/files/route.ts` (Line 51) — Missing request schema validation
- **L17.** `admin/approvals/route.ts` (Line 83) — Missing explicit undefined check
- **L18.** `admin/tasks/route.ts` (Line 75) — Missing explicit undefined check
- **L19.** `admin/files/route.ts` (Line 71) — Missing explicit undefined check
- **L20.** `contact/route.ts` (Line 118) — Missing explicit undefined check

### L21–L30: More missing result/validation checks
- **L21.** `dashboard/approvals/route.ts` (Line 75) — Missing explicit undefined check
- **L22.** `dashboard/files/route.ts` (Line 59) — Missing explicit undefined check
- **L23.** `dashboard/onboarding/route.ts` (Line 103) — Missing explicit undefined check
- **L24.** `admin/approvals/route.ts` (Line 59) — Missing content-type enum validation
- **L25.** `rate-limit.ts` (Line 23-38) — Return object not validated
- **L26.** `supabase.ts` (Line 10-11) — Throws instead of graceful degradation
- **L27.** `admin/clients/route.ts` (Line 97) — localhost fallback in production URLs
- **L28.** `middleware.ts` (Line 12-14) — Hardcoded redirect paths
- **L29.** `contact/route.ts` (Line 141-143) — Truncated error logging
- **L30.** `admin/leads/page.tsx` (Line 280) — Missing loading state on Save Notes

### L31–L42: Missing accessibility
- **L31.** `Hero.tsx` (Line 5) — Section missing aria-label
- **L32.** `Services.tsx` (Line 5) — Section id used as anchor but no heading
- **L33.** `not-found.tsx` (Line 15) — Missing aria-label for 404 code
- **L34.** `not-found.tsx` (Line 1) — Missing semantic structure
- **L35.** `error.tsx` (Line 20) — Button missing type="button"
- **L36.** `ContactForm.tsx` (Line 103) — Form labels missing htmlFor (6 instances)
- **L37.** `Packages.tsx` (Line 22) — 4-column grid may need mobile testing
- **L38.** `admin/layout.tsx` (Line 3) — Missing metadata export for admin
- **L39.** `layout.tsx` (Line 46) — Missing favicon/manifest in head
- **L40.** `AdminSidebar.tsx` (Line 50) — Backdrop div missing role="button"
- **L41.** `Navbar.tsx` (Line 76-78) — Hamburger icon using divs instead of SVG
- **L42.** `admin/leads/page.tsx` (Line 32) — Missing sanitization in CSV export

### L43–L57: Code quality / performance
- **L43.** `Hero.tsx` (Line 44) — stats map without stable key
- **L44.** `ProofBar.tsx` (Line 8) — icon text as key
- **L45.** `Services.tsx` (Line 16) — service.title as key
- **L46.** `Packages.tsx` (Line 23) — pkg.tier as key
- **L47.** `Packages.tsx` (Line 54) — feat.text as key
- **L48.** `Process.tsx` (Line 19) — step.num as key
- **L49.** `About.tsx` (Line 27) — val.title as key
- **L50.** `About.tsx` (Line 63) — member.name as key
- **L51.** `Footer.tsx` (Line 10) — link text as key
- **L52.** `ContactForm.tsx` (Line 179) — opt value as key
- **L53.** `Navbar.tsx` (Line 48) — Using a tags with hash hrefs
- **L54.** `Navbar.tsx` (Line 41) — Logo link should use next/link
- **L55.** `login/page.tsx` (Line 53) — a tag instead of Link component
- **L56.** `tailwind.config.ts` (Line 27-29) — sans/serif both point to Montserrat
- **L57.** `globals.css` (Line 22-26) — Hardcoded gradient colors, not CSS variables

---

## Fix Plan

### Phase 1: Critical Fixes (C1–C18)
1. Complete all 9 truncated files
2. Implement seedAdmin function
3. Fix StatCard component
4. Add auth guards to dashboard/admin layouts
5. Fix open redirect and role-based redirect vulnerabilities
6. Fix accessibility violations on interactive elements

### Phase 2: High Priority Fixes (H1–H78)
1. Add try-catch blocks to all unprotected API handlers
2. Remove plaintext password from welcome email
3. Add proper input validation to all API endpoints
4. Add loading/disabled states to all form submit buttons
5. Add AbortController cleanup to all useEffect hooks
6. Add proper error display and recovery to all pages
7. Sanitize user content before display

### Phase 3: Medium Priority Fixes (M1–M112)
1. Add null checks throughout
2. Fix type safety issues
3. Add key props to all map() calls
4. Add AbortController to remaining useEffects
5. Add error recovery UI
6. URL encode all query parameters

### Phase 4: Low Priority Fixes (L1–L57)
1. Improve logging and error reporting
2. Add accessibility attributes
3. Replace a tags with next/link
4. Use stable keys for component lists
5. Minor code quality improvements
