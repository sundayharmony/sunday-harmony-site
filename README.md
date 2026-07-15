# Sunday Harmony — Website

Marketing website for Sunday Harmony, NJ's all-in-one marketing agency for small businesses.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Next.js API Routes + Nodemailer
- **Deployment:** Vercel (recommended), Netlify, or any Node.js host

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── contact/
│   │       └── route.ts      # Contact form API endpoint
│   ├── layout.tsx             # Root layout with fonts & metadata
│   └── page.tsx               # Home page (assembles all sections)
├── components/
│   ├── Navbar.tsx             # Fixed navigation + mobile menu
│   ├── Hero.tsx               # Hero section with stats
│   ├── ProofBar.tsx           # Social proof strip
│   ├── Services.tsx           # 6 service cards
│   ├── Packages.tsx           # 4 pricing tiers
│   ├── Process.tsx            # 4-step process
│   ├── About.tsx              # About + Team sections
│   ├── CtaBanner.tsx          # Call-to-action banner
│   ├── ContactForm.tsx        # Contact form with API integration
│   ├── Footer.tsx             # Site footer
│   └── Divider.tsx            # Section divider
├── lib/
│   └── data.ts                # All site content & data
└── styles/
    └── globals.css            # Tailwind + custom styles
```

## Contact Form Setup

The contact form works out of the box (logs to console). To enable email notifications:

1. Copy `.env.example` to `.env.local`
2. Fill in your SMTP credentials (Gmail, Outlook, SendGrid, etc.)
3. Restart the dev server

### Gmail Example

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NOTIFY_EMAIL=sales@sundayharmony.com
```

> For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

Keep production credentials in the hosting dashboards and use only `.env.local`
for local development. Every `.env.*` file is gitignored except
`.env.example`. Before committing, run `npm run security:scan-secrets` to scan
the staged files for common credential formats.

### Netlify

1. Set `output: 'export'` in `next.config.js` (for static export)
2. Run `npm run build`
3. Deploy the `out/` folder

## Rate limiting

Login and contact endpoints use an in-memory rate limiter (`src/lib/rate-limit.ts`). On Vercel or any multi-instance host, limits are **per instance** and reset when a function cold-starts. That is acceptable for light traffic; for stronger guarantees use a shared store (for example Upstash Redis or Vercel KV).

## Stripe webhooks

Apply `supabase-migration-005-stripe-webhook-events.sql` (or the matching block in `supabase-schema.sql`) so duplicate Stripe deliveries are ignored after a successful run. Test locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Example event payloads for manual testing live under `tests/fixtures/`.

## Client file vault (Supabase Storage)

Admin and client **Document vault** uploads go to a **private** Storage bucket `client-files`. The app serves downloads via **signed URLs** (`src/lib/client-files-storage.ts`).

1. Prefer [`supabase-migration-017-client-files-private.sql`](supabase-migration-017-client-files-private.sql) and [`supabase-migration-020-fix-permissive-rls.sql`](supabase-migration-020-fix-permissive-rls.sql) (private bucket + deny-by-default RLS). Do **not** leave `client-files` public.
2. Ensure `NEXT_PUBLIC_SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY` are set. The legacy `SUPABASE_SERVICE_ROLE_KEY` name remains supported as a fallback. Never expose either key through a `NEXT_PUBLIC_` variable.
3. Verify anon cannot read CRM tables: `npm run security:verify-anon-rls`.

**Limits:** uploads are capped at **4 MB** per file in code (`src/lib/client-files-storage.ts`) to stay within typical **Vercel serverless request body** limits. Raising the limit requires a compatible Vercel plan and confidence your function timeout and body parser behavior support larger payloads.

**Allowed types:** PDF, common images, plain text, CSV, Word, Excel, zip (see allowlist in `client-files-storage.ts`). Deletes remove both the DB row and the Storage object when the path resolves to this bucket.

## Admin Leads — Google Places discovery

The **Find Businesses** tool on `/admin/leads` calls Google’s **Places API (New)** (`places:searchText`). For production (e.g. Vercel), set **`GOOGLE_PLACES_API_KEY`** in the host’s environment variables, enable **Places API (New)** on that key in [Google Cloud Console](https://console.cloud.google.com/), and redeploy. Without the key, the API returns **503** and the UI shows the server error message.

## E2E smoke tests (optional)

After `npm install`, install browsers once with `npx playwright install`. Run `npm run test:e2e` with the dev server stopped (Playwright starts `next dev` via config) or set `PLAYWRIGHT_BASE_URL` to a running app URL.

## Editing Content

All website content lives in `src/lib/data.ts`. Edit services, packages, team members, and pricing there — the components will update automatically.
