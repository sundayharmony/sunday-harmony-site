# CLAUDE.md — Sunday Harmony

Read by every Claude Code session in this repo. Mirrors the Sunday Harmony Project docs (context, ICP, design rules, model rules); when those docs change, update this file in the same session so the two match. Dev setup, tests and deploy notes live in AGENTS.md:

@AGENTS.md

## The business
- **Sunday Harmony Consulting**: online agency (started in Jersey City, NJ) selling brand, strategy and systems to small businesses anywhere in the US. Run by MC alone; staff roles in the app (sales_closer, lead_procurement, client_relations, credit_manager) are meant for AI agents and VAs.
- **Goal: $10K revenue every week.** Focus now is consulting packages; credit analysis is secondary and needs cleanup.
- **Public face is consulting.** Credit repair and business funding are separate doors behind the same site (see BRAND.md).
- **Offers (list prices in code):** Business Essentials from $899 · Business Launch from $2,499 · Marketing Partner $1,200/mo · Custom quote. Front-end offer: free audit.
- Contact: sales@sundayharmony.com.

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
- Lead importer lives outside this repo and used old prices ($599/$1,799/$799); check imported leads use current prices.
- `BUG_AUDIT_REPORT.md` is superseded; re-check before trusting it.
