# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **Next.js 15 (App Router) + TypeScript** app: the Sunday Harmony
marketing website plus admin/client portals (Supabase-backed), Stripe billing,
and an **optional** Python `dispute-letters-api` microservice under
`services/dispute-letters-api/`.

The update script already runs `npm ci`, so dependencies are installed on
startup. Standard scripts live in `package.json`; the CI pipeline is
`.github/workflows/ci.yml` (`lint` → `typecheck` → `test:unit`, plus
`python-letters` pytest with `services/dispute-letters-api/requirements-test.txt`).

### Running the app (dev)

- Start the dev server with `npm run dev` (serves on `http://localhost:3000`).
- **No secrets are required to boot.** The app runs without any `.env.local`.
  The contact form, homepage, and most public pages work out of the box; the
  contact API returns success even without SMTP/Supabase configured (email is
  skipped and the DB write is caught/ignored). See `src/app/api/contact/route.ts`.
- Features that need external services degrade gracefully or return errors when
  their env vars are unset: Supabase (admin/client portals, leads persistence),
  Stripe (billing), Google Places (admin leads discovery, returns 503), Gemini
  (marketing graphics), and the dispute-letters API. Configure the relevant
  vars from `.env.example` in a `.env.local` only when working on those areas.

### Testing / quality

- Lint: `npm run lint` (currently emits only warnings, no errors).
- Types: `npm run typecheck`.
- Unit tests: `npm run test:unit` (node test runner via `tsx`; ~125 tests).
- Python letters tests: `cd services/dispute-letters-api && pip install -r requirements-test.txt && PYTHONPATH=. pytest app/services/__tests__`.
- E2E (optional): `npm run test:e2e` requires a one-time
  `npx playwright install` for browsers, and Playwright starts its own
  `next dev` — stop any running dev server first or set `PLAYWRIGHT_BASE_URL`.
  Browsers are **not** installed by the update script.

### Shipping to main

After the change is implemented and tests pass, **merge into `main` and push**
(`git push -u origin main`, no force-push). Production deploys from `main`.
Do not leave finished, tested work only on a feature branch.

### Optional Python service (`services/dispute-letters-api`)

Needed for Admin → Dispute Letters / Credit Intelligence letter generation. It is a FastAPI
service with its own `requirements.txt` and is normally deployed to **Render**
(`dispute-letters-api`). It is not part of the default Next.js dev loop and is not installed
by the update script.

**Ship site + API together.** Vercel deploys the Next.js app from `main`. Letter generate,
analyze, health recompute, and ZIP contents also depend on the Python API. After merging
dispute-letter or Credit Intelligence changes to `main`, redeploy **both** Vercel and the
Render `dispute-letters-api` service. A site-only deploy can leave generate/ZIP/analysis
on an old API. Prefer ZIP/preview/list filtering on Next.js so a lagging API cannot
resurrect `.txt` files or duplicate letters.

Python service tests (no OCR): from `services/dispute-letters-api`,
`pip install -r requirements-test.txt` then `PYTHONPATH=. pytest app/services/__tests__`.
