# Ops digest (machine + staff)

Short rules extracted from Stephen Smith video playbooks for prompts and UI. Full detail remains in sibling playbooks.

## Round strategy (Sunday Harmony)

1. Round 1 → generate letters for **Equifax, Experian, and TransUnion** (≤7 items each).
2. Fill Round 1 slots with **evidence-grounded cross-bureau inconsistencies** first.
3. Do **not** treat “missing on another bureau” alone as an error.
4. After mismatches are deleted/aligned, Round 2+ targets **consistent inaccuracies** still on the reporting bureaus.
5. Prefer specific defect language (dates, balances, payment-history cells) over generic templates.
6. CFPB / FTC / Rising portal steps stay **manual** outside letter generate.
7. Never put DOB, full SSN, or street address into AI prompts.

## Inconsistency (dispute-worthy)

- Same account reports differently across **two or more bureaus that list it** (e.g. late month on EQF, OK on EXP/TUC).
- Ask the inaccurate bureau(s) to update or delete unverifiable history under FCRA §611.

## Consistent inaccuracy

- Same defect appears on every bureau that reports the account.
- Challenge verification of that shared defect; do not invent bureau-only mismatches.

## Utilization / inquiries / Rising

- Utilization restructuring, 401(k), business credit, velocity banking → staff coaching (PDF), not letter invent.
- Hard inquiries 2026 → FTC affidavit + CFPB path is portal-manual; product letters are fallback.
- Rising Dispute Hub is parallel tooling; mirror outcomes into Sunday Harmony rounds.
