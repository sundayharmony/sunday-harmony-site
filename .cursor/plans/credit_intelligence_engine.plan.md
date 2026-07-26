# Credit Intelligence Engine Upgrade

## Goal

Replace isolated dispute-letter generation with a **Credit Intelligence Engine** that analyzes the full client profile (credit report + funding intake + documents) and embeds dispute letters inside the Credit & Funding **Under Review** workflow.

## Knowledge grounding (synthesized, not copied)

Sources studied for factor framing, dispute process, and FCRA timing:

- CFPB credit reports/scores & score education
- FTC disputing errors guidance
- myFICO educational factor framing (~35/30/15/10/10)
- FCRA §605 / §611 / §623 (obsolescence, reinvestigation, furnishers)
- Bureau consumer education themes (utilization, inquiries, mix, age)

Platform rules:

- Educational analysis only — no score guarantees or approval predictions
- Cite statutes only when facts support them
- Prefer deletion language for closed/obsolete negatives when appropriate

## Architecture

```
Credit report upload (linked to application_uuid)
        ↓
Ingest + AI extract (limits, dates, DOFD, inquiries, public records)
        ↓
credit_health.py (priority / dispute selection)
        ↓
credit_intelligence.py (factors + funding readiness + recommendations)
        ↓
Admin Credit & Funding → Credit Intelligence tab
        ↓
Dispute letters workflow (contextualized letter generation)
```

## Delivered in this phase

1. **Python Credit Intelligence Engine** — payment history, revolving utilization, installment, collections, charge-offs, inquiries, public records, mix, account age, overall health, funding readiness, ranked recommendations, account dispute insights
2. **Expanded tradeline fields** — credit_limit, dates, payment history, etc.
3. **Migration 028** — `application_uuid` + `intelligence_json` on `dispute_sessions`
4. **Letter generation** — uses intelligence notes per disputed account
5. **Admin UI** — Credit Intelligence tab on application detail; enriched health page
6. **APIs** — by-application sessions; rebuild intelligence with funding context

## Apply migration

Run `supabase-migration-028-credit-intelligence.sql` in the Sunday Harmony Supabase SQL Editor before relying on linked sessions / intelligence_json columns.

## Follow-ups (future)

- Client-portal read-only intelligence summary
- Multi-round dispute outcome tracking
- Normalized tradeline tables for trends
- Auto-suggest funding_scores.credit_readiness from intelligence
- Pull reports from monitoring providers via stored credentials
