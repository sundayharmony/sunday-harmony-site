---
name: "Area 03 Fix Plan — Service-role Key + Secret Hygiene"
overview: "Service-role key is correctly server-only and no secrets are in git history, but several live-secret .env files sit untracked yet un-ignored (one git add from leaking). Plan: close the .gitignore gap, consolidate/scrub local secret dumps, standardize the Supabase key name, add a secret-scan guard, and decide on rotation. Implement only after approval."
todos:
  - id: gitignore-gap
    content: "Ignore all .env.* secret dumps (.env.vercel.production, .env.migration-check, .env.railway-deploy)"
    status: pending
  - id: scrub-local-dumps
    content: "Consolidate to one local secret file; delete redundant dumps + loose probe scripts"
    status: pending
  - id: key-name-standardize
    content: "Confirm prod Supabase key name (SERVICE_ROLE vs SECRET) and standardize supabase.ts"
    status: pending
  - id: secret-scan-guard
    content: "Add pre-commit / npm secret-scan to block committing keys"
    status: pending
  - id: rotation-decision
    content: "Decide whether to rotate service-role key + DB password (disruptive)"
    status: pending
isProject: false
---

# Area 03 — Deep dive + fix plan

**Status:** plan-ready (awaiting permission to implement)
**Priority:** P0 (last of the three)
**Scope:** How the service-role key and other secrets are stored, exposed, and rotated.

---

## What's already good

- **Service-role key is server-only.** Only `src/lib/supabase.ts` reads `SUPABASE_SERVICE_ROLE_KEY`; no `NEXT_PUBLIC_` prefix, so it never ships to the browser bundle.
- **No secrets in git history.** The only tracked env file is `.env.example` (a safe placeholder template). `git log --all -- '.env*'` shows only `.env.example`.
- **No `NEXT_PUBLIC_` variable holds a secret.** The only public vars are the Supabase URL, anon/publishable key, Stripe publishable key, and site URL — all safe to expose.
- **No hardcoded secrets in `src/`.** All secrets come from `process.env`.
- **Anon key is now safe** after Area 01 (RLS deny-by-default), so an exposed anon/publishable key no longer reads data.

---

## Findings / risks

### 1. `.gitignore` gap — live secret files are not ignored (highest priority)

`.gitignore` currently covers `.env`, `.env.local`, `.env.production.local`, and `.env*.local`. It does **not** cover these files that are present in the repo root and contain real secrets:

| File | Status | Contains |
|------|--------|----------|
| `.env.vercel.production` | untracked, **not ignored** | anon JWT, publishable key, (service role / Postgres password / Stripe / SMTP per full dump) |
| `.env.migration-check` | untracked, **not ignored** | same class of secrets |
| `.env.railway-deploy` | untracked, **not ignored** | same class of secrets |
| `.env.production.local` | untracked, ignored (ok) | — |

Because they are untracked but not ignored, a single `git add -A` (or an editor "stage all") would commit live production secrets. This is the most likely real-world leak path.

### 2. Redundant local secret dumps

The same secrets are duplicated across at least four files on disk (`.env.vercel.production`, `.env.migration-check`, `.env.railway-deploy`, `.env.production.local`, plus a temporary `.env.vercel-pull-tmp` I created and deleted during Area 01). More copies = larger local attack surface and more chances to mis-handle one.

### 3. Service-role concentration (by design, but note it)

All app DB/storage access uses one `SUPABASE_SERVICE_ROLE_KEY` that **bypasses RLS**. After Area 01 this is the single most powerful secret: if it leaks, an attacker has full read/write to every table and private bucket regardless of RLS. There is no secondary control. This is an accepted architecture, but it raises the importance of items 1, 4, and 5.

### 4. Supabase key-name inconsistency

`src/lib/supabase.ts` reads **only** `SUPABASE_SERVICE_ROLE_KEY`. Local `.env.local` uses the new-format `sb_secret_...` value under that name (works). The Vercel dump also defines `SUPABASE_SECRET_KEY` / `SUPABASE_PUBLISHABLE_KEY` (new Supabase key names). Risk: if someone sets only `SUPABASE_SECRET_KEY` in an environment and leaves `SUPABASE_SERVICE_ROLE_KEY` empty, the app throws "credentials not configured". Worth standardizing and documenting one canonical name with a fallback.

### 5. No automated secret-scan guard

Nothing stops a future `git add` from committing a key. A lightweight guard (pre-commit hook or npm script) would catch `sb_secret_`, `sk_live_`, `whsec_`, JWT, and `postgres://` patterns in staged files.

### 6. Loose one-off scripts in repo root `scripts/`

`scripts/check-env-keys.mjs`, `scripts/test-dispute-env.mjs`, `scripts/test-dispute-upload-flow.mjs` are untracked. They read secrets from `.env*` (they do **not** hardcode secrets), but they're clutter and print secret **lengths**/health. Should be removed or folded into the documented `security:*` / `diagnostic:*` scripts.

---

## Fix plan (implement after approval)

### Step 1 — Close the `.gitignore` gap (fast, highest value)

Add patterns so every environment dump is ignored except the template:

```gitignore
# Environment (ignore everything except the example template)
.env
.env.*
!.env.example
```

Then confirm with `git status` that `.env.vercel.production`, `.env.migration-check`, `.env.railway-deploy` drop off the untracked list.

### Step 2 — Consolidate local secret files

- Keep **one** gitignored local file for app dev: `.env.local`.
- Delete the redundant dumps (`.env.vercel.production`, `.env.migration-check`, `.env.railway-deploy`) after confirming their values live in Vercel (`vercel env`) and Railway. Re-pull on demand with `vercel env pull .env.local` rather than keeping standing copies.
- Remove loose probe scripts (`check-env-keys.mjs`, `test-dispute-env.mjs`, `test-dispute-upload-flow.mjs`) or move needed ones under the documented `security:*` scripts.
- Treat Vercel/Railway dashboards as the source of truth.

### Step 3 — Standardize the Supabase key name

- Update `src/lib/supabase.ts` to accept `SUPABASE_SERVICE_ROLE_KEY` **or** `SUPABASE_SECRET_KEY` (fallback), so either Supabase key naming works.
- Document the canonical name in `.env.example` and README.
- No behavior change when `SUPABASE_SERVICE_ROLE_KEY` is set (current prod).

### Step 4 — Add a secret-scan guard

- Add `scripts/scan-staged-secrets.mjs` that greps staged diffs for `sb_secret_`, `sk_live_`, `sk_test_`, `whsec_`, `eyJhbGciOiJ` (JWT), and `postgres(ql)?://` and exits non-zero.
- Wire as an npm script `security:scan-secrets` and optionally a Husky/simple `.git/hooks/pre-commit` (documented, opt-in — do not force hooks without asking).

### Step 5 — Rotation decision (needs your call)

Rotation is disruptive (requires updating Vercel + Railway + local), so this is a decision, not an automatic action:

- **Service-role key:** Not known to have leaked (Area 01 exposure was the *anon* key via RLS, plus password hashes — both already handled). Rotate only if you want to be conservative given multiple local dumps existed.
- **Postgres password:** Same reasoning.
- **Recommendation:** rotate the **service-role key** and **Postgres password** once, now that RLS is fixed and passwords were already reset — clean slate. If you agree, I'll provide exact Supabase dashboard steps and update Vercel/Railway.

### Out of scope for Area 03

- `SETUP_TOKEN` / setup route lockdown → Area 12
- Password hashing → Area 04
- CSP/XSS → Area 05

---

## Implementation order when approved

1. `.gitignore` fix + confirm untracked secret files disappear
2. Standardize `supabase.ts` key name + docs
3. Secret-scan script + npm wiring
4. Scrub redundant local dumps + loose scripts
5. (If approved) rotation runbook + update envs
6. Commit and push

---

## Success criteria

- [ ] No live-secret file can be committed without tripping ignore rules + scan
- [ ] Only `.env.example` is tracked
- [ ] One canonical local env file
- [ ] `supabase.ts` works with either Supabase key name
- [ ] Rotation decision recorded (done or explicitly deferred)
