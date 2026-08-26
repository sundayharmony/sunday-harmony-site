# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **Next.js 15 (App Router) + TypeScript** app: the Sunday Harmony
marketing website plus admin/client portals (Supabase-backed), Stripe billing,
and an **optional** Python `dispute-letters-api` microservice under
`services/dispute-letters-api/`.

The update script already runs `npm ci`, so dependencies are installed on
startup. Standard scripts live in `package.json`; the CI pipeline is
`.github/workflows/ci.yml` (`lint` → `typecheck` → `test:unit`).

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
- E2E (optional): `npm run test:e2e` requires a one-time
  `npx playwright install` for browsers, and Playwright starts its own
  `next dev` — stop any running dev server first or set `PLAYWRIGHT_BASE_URL`.
  Browsers are **not** installed by the update script.

### Optional Python service (`services/dispute-letters-api`)

Only needed for Admin → Dispute Letters. It is a FastAPI service with its own
`requirements.txt` and is normally deployed to Railway. It is not part of the
default dev loop and is not installed by the update script.
