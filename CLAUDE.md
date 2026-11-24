# CLAUDE.md — Sunday Harmony

Read by every Claude Code session in this repo. Mirrors the Sunday Harmony Project docs (context, ICP, design rules, model rules); when those docs change, update this file in the same session so the two match. Dev setup, tests and deploy notes live in AGENTS.md:

@AGENTS.md

## The business
- **Sunday Harmony Consulting**: online agency (started in Jersey City, NJ) selling brand, strategy and systems to small businesses anywhere in the US. Run by MC alone; staff roles in the app (sales_closer, lead_procurement, client_relations, credit_manager) are meant for AI agents and VAs.
- **Goal: $10K revenue every week.** Focus now is consulting packages; credit analysis is secondary and needs cleanup.
- **Public face is consulting.** Credit repair and business funding are separate doors behind the same site (see BRAND.md).
- **Offers (list prices in code):** Business Essentials from $899 · Business Launch from $2,499 · Marketing Partner $1,200/mo · Custom quote. Front-end offer: free audit.
- Contact: sales@sundayharmony.com · (609) 400-4459 · PO Box 1011, Jersey City, NJ 07304 (email footer).

## Outreach rules (mirrors Project doc `claude/outreach-rules.md`)
- Cold outreach sends from **sales@**; everything else (site, transactional, marketing) from **contact@**.
- Every marketing email footer has the mailing address **PO Box 1011, Jersey City, NJ 07304** (`OUTREACH_MAILING_ADDRESS`) and an unsubscribe link. Sign as "Sunday Harmony", never a personal name.
- No prices in emails; prices come up on the call. Booking link: /book.
- Send Tue–Thu only. Send every qualified prospect ready that day, within a warm-up cap: start ~75/day, +25% per send day while bounces <3% and spam complaints ~0; pause and alert MC otherwise. Overflow rolls to the next send day.
- Fully automatic: no manual approval. Code pre-send checks (no blank merge fields, footer + unsubscribe present, audit link loads, not suppressed); after every batch the system reviews results and adjusts.
- Urgency only if true (e.g. ~8 projects/week capacity). Only real proof; no invented testimonials or results.
- Leads already emailed get the audit as a new email if they score 50+.
- Ask MC questions before starting anything new; after that, act without further approval.

## Copy rules
- Plain English, direct, short. No jargon, no long-term contracts.
- Never guarantee results or credit-score changes.
- Never claim "150+ businesses served" or "4+ years of experience" (removed as inaccurate). No made-up stats, reviews or testimonials.
- No local-city claim; we serve the whole US.

## Ideal customer (for lead scoring and outreach)
Established US service business, high-margin or high-ticket ($300+ sale or repeat), 2+ years open, 4.3★+ with 30+ Google reviews, and a visible online gap (no/broken site, weak Google profile, mismatched brand). Lower fit: pizzerias, diners, bakeries, coffee shops, single-chair barbers/nail salons. Disqualify: unclaimed listings, corporate-branded franchises, unreachable owners.
Score out of 100: industry 25 · reviews 20 · visible gap 20 · pays for software/ads 15 · size 10 · owner reachable 10. **70+ call then email · 50–69 email only · under 50 don't contact.**

## Design rules (source of truth: BRAND.md, `src/styles/globals.css`, `tailwind.config.ts`, `src/lib/brand-tokens.ts`)
- Cream pages `#fbf7f0`, paper cards `#fffdf8`, hairlines `#e6dbc6`. No pure white pages, grey gradients, grids or glows.
- Headings Fraunces 600, tight tracking, one color. Body/UI Montserrat.
- Gold `#b8943f` for fills, rules and text on dark. Gold text on cream uses `#7f6427` or `#8a6416` for contrast.
- Labels: small uppercase letter-spaced gold text, not chips.
- Buttons: ink pills (primary), outlined pills (secondary), 44–48px+ tall.
- Cards: 20–28px corners; clickable ones lift 4–6px on hover with gold border and soft shadow.
- Motion: `cubic-bezier(0.22, 1, 0.36, 1)` at 400–500ms; cross-fade, never snap with `display:none`. Respect reduced motion.
- Desktop rails pin and scroll sideways; phones swipe. Hover-only content is shown up front on touch.
- Dark bands (`#1b1a17`) once or twice per page.
- **Check every UI change at desktop width and ~390px before shipping.**

### PDFs (template: `src/lib/icp-audit-pdf.ts`, approved 2026-11-23)
- Embed Fraunces 600 + Montserrat 400/600/700 from `src/assets/fonts`; add them to `outputFileTracingIncludes` in `next.config.js` for the PDF route. Never ship Times/Helvetica.
- Page 1: ink cover band (white logo, gold label + Eastern-time date, client name in Fraunces cream, headline number as a gold dial), then "What is working", an at-a-glance tile grid, and "Fix these first" (top 3 + package). Details from page 2.
- Detail cards: paper, hairline, 16pt corners, status pill, drawn icons (green check / rust cross / grey ?), muted notes, gold "Fixed in {package}:" line.
- Status colors: 80+ green, 50–79 gold, under 50 rust, grey not checked; always with a word.
- Close with an ink plan panel (gold numbered circles, package names, gold "Book your free 30-minute call" pill to /book, phone). No prices.
- Keep cards whole on a page; footer on every page with contact line, PO Box and page numbers.
- Render every page to images and check before shipping (short/long names, thin/full data).

## AI and data rules (budget: Claude $20/mo is the only AI spend)
- **Code before AI.** Scoring, parsing, routing, templates, dispute letters and merge fields are plain code, not model calls.
- **Never add a paid AI service or API key** without MC's OK.
- Free-tier AI APIs only for **public business data** (names, listings, websites, reviews).
- **Client and credit data never goes to any AI**: credit reports, SSNs, DOBs, addresses, bureau logins, finances, private messages. Use local parsers/templates; test with fake data.
- No Cursor agent in the product.
- Subagents and scheduled tasks: pick the cheapest model that fits (Haiku for lookups and simple edits, Sonnet for most coding and drafts, Opus for hard or high-stakes work). Keep reads and tool calls lean.

## How to work in this repo (mirrors `.cursor/rules/`)
- **Ponytail:** smallest complete change. Reuse what exists; no new dependencies for a few lines; no speculative abstractions. End with one line on what you skipped and any risk.
- **Graphify first:** if Graphify MCP tools are connected, use them to find definitions, callers and blast radius before grep.
- **Mobile matches desktop** in the same change, including the mobile menu.
- **Ship:** after lint, typecheck and unit tests pass, merge to `main` and push (no force-push). Production deploys from `main`. Dispute-letter changes also need the Render `dispute-letters-api` redeployed.
- Never commit secrets (`.env*`, keys, credential files) or diagnostic dumps.
- The old lead importer was a paid Grok bot outside this repo (retired); it used old prices ($599/$1,799/$799). New lead finding is built inside this repo.
- Google APIs (Places, PageSpeed) read `GOOGLE_PLACES_API_KEY` (Places) or `GOOGLE_API_KEY` from env; never hard-code or commit it. Stay within free usage.
- `BUG_AUDIT_REPORT.md` is superseded; re-check before trusting it.
