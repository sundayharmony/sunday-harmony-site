---
name: "Area 04 Fix Plan — Password Hashing + Compare Hardening"
overview: "Password hashes use PBKDF2-SHA512 at only 10,000 iterations with a non-timing-safe string compare and no versioned format. Plan: versioned hash format at 210,000 iterations, timingSafeEqual verify, transparent rehash-on-login so existing users upgrade automatically. Implement only after approval."
todos:
  - id: versioned-hash
    content: "New versioned hash format at 210k iterations + timingSafeEqual verify"
    status: pending
  - id: rehash-on-login
    content: "Transparent rehash-on-login for legacy 10k-iteration hashes"
    status: pending
  - id: tests
    content: "Unit tests: legacy verify, new verify, rehash detection, tamper cases"
    status: pending
  - id: verify-push
    content: "Typecheck + tests, commit, push"
    status: pending
isProject: false
---

# Area 04 — Deep dive + fix plan

**Status:** plan-ready (awaiting permission to implement)
**Priority:** P1 (first after the P0s)
**Scope:** `hashPassword` / `verifyPassword` in `src/lib/db.ts` and every caller.

---

## Current state

```10:20:src/lib/db.ts
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return hash === verify
}
```

Callers (all go through these two functions — single choke point, good):

| Caller | Uses |
|--------|------|
| `src/lib/auth.ts` (NextAuth `authorize`) | `verifyPassword` |
| `src/app/api/dashboard/settings/route.ts` (change password) | `verifyPassword` + `updateUser` → `hashPassword` |
| `src/app/api/auth/reset-password/route.ts` | `hashPassword` |
| `src/lib/db.ts` `createUser` / `updateUser` / `seedAdmin` | `hashPassword` |
| `scripts/invalidate-exposed-auth.mjs` | reimplements the same format (must stay in sync) |

## Findings

### 1. Iteration count is 21× below current guidance (main issue)

10,000 PBKDF2-SHA512 iterations vs OWASP's current recommendation of **210,000**. Context: password hashes for all users were exposed by the pre-Area-01 RLS hole. Passwords have since been rotated, but any future exposure should meet modern cracking-cost expectations. At 10k iterations, a modern GPU rig tests hundreds of thousands of guesses per second per hash.

### 2. Non-timing-safe compare

`hash === verify` leaks comparison timing. Practical exploitability is low (the attacker would need to control `stored`, and PBKDF2 dominates timing), but `crypto.timingSafeEqual` is the correct primitive and already used elsewhere in the codebase (`verification-token.ts`, `credit-funding-signing.ts`, MFA challenge in `auth.ts`).

### 3. No versioned hash format → can't raise cost without breaking logins

Format is bare `salt:hash` with iterations implied. Raising iterations naively would lock out every existing user. Need an explicit version/cost marker plus **rehash-on-login**.

### 4. Malformed-hash edge case

`stored.split(':')` with no colon yields `hash === undefined`; empty `stored` passes `''` as salt to PBKDF2. Neither authenticates, but verify should fail fast and never throw.

### What's already fine (no action)

- Password policy: 8–128 chars, upper/lower/digit enforced on both change and reset paths.
- Reset codes: hashed at rest, compared with `timingSafeEqual`, rate-limited by IP/email/code.
- Login: rate-limited per email; staff protected by MFA (Area 02).
- `pbkdf2Sync` blocking: at 210k iterations ~50–150ms per call on serverless — acceptable for login frequency; not worth an async refactor now.

---

## Fix plan (implement after approval)

### Step 1 — Versioned hash format in `src/lib/db.ts`

- New hashes: `pbkdf2$210000$<salt>$<hash>` (algorithm + explicit iteration count).
- `hashPassword` writes the new format at 210,000 iterations.
- `verifyPassword` parses both formats:
  - New format → verify with embedded iteration count.
  - Legacy `salt:hash` → verify at 10,000 (compat).
  - Anything malformed → return false, never throw.
- All comparisons via `crypto.timingSafeEqual` on hex-decoded buffers with length check.
- Add `passwordNeedsRehash(stored): boolean` — true for legacy format or iterations below current cost.

### Step 2 — Transparent rehash-on-login

- In `authorize` (`src/lib/auth.ts`): after a successful `verifyPassword`, if `passwordNeedsRehash`, write back `hashPassword(password)` (fire-and-forget, non-blocking on failure).
- Same in the change-password route's current-password check (it rehashes anyway via update).
- Result: every active user upgrades to 210k on next login with zero disruption; stale accounts stay verifiable via the legacy path.

### Step 3 — Sync the ops script

- `scripts/invalidate-exposed-auth.mjs` duplicates the old hash format; update it to emit the new format (per the no-duplicate-code rule, keep the format constants in one place as far as an `.mjs` script allows).

### Step 4 — Tests

Extend unit tests (`src/lib/__tests__/`):
- New-format hash verifies; wrong password fails.
- Legacy-format hash still verifies; `passwordNeedsRehash` flags it.
- Malformed stored values (`''`, no separator, bad hex) return false without throwing.

### Risk

Low. Legacy verification path keeps every existing hash working; new format only applies on write. Worst case a rehash write fails silently and the user simply stays on the legacy hash until next login.

---

## Success criteria

- [ ] New hashes at 210,000 iterations, versioned format
- [ ] `timingSafeEqual` everywhere passwords are compared
- [ ] Legacy hashes verify and upgrade on login
- [ ] Malformed hashes fail closed without exceptions
- [ ] Unit tests cover legacy/new/malformed paths
