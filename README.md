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

### Netlify

1. Set `output: 'export'` in `next.config.js` (for static export)
2. Run `npm run build`
3. Deploy the `out/` folder

## Rate limiting

Login and contact endpoints use an in-memory rate limiter (`src/lib/rate-limit.ts`). On Vercel or any multi-instance host, limits are **per instance** and reset when a function cold-starts. That is acceptable for light traffic; for stronger guarantees use a shared store (for example Upstash Redis or Vercel KV).

## Stripe webhooks

Apply `supabase-migration-005-stripe-webhook-events.sql` (or the matching block in `supabase-schema.sql`) so duplicate Stripe deliveries are ignored after a successful run. Test locally with the [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Example event payloads for manual testing live under `tests/fixtures/`.

## E2E smoke tests (optional)

After `npm install`, install browsers once with `npx playwright install`. Run `npm run test:e2e` with the dev server stopped (Playwright starts `next dev` via config) or set `PLAYWRIGHT_BASE_URL` to a running app URL.

## Editing Content

All website content lives in `src/lib/data.ts`. Edit services, packages, team members, and pricing there — the components will update automatically.
