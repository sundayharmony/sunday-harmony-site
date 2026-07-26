---
name: credit-letter-legal
description: Applies federal consumer credit law from the project knowledge base when drafting or reviewing credit dispute letters, debt validation requests, billing error notices, or adverse-action correspondence. Use for FCRA, FDCPA, FCBA, ECOA, TILA, 15 U.S.C. §1681, furnishers, credit bureaus, debt collectors, and credit letter automation.
---

# Credit Letter Legal Knowledge

## Quick Start

1. Identify the letter type using [dispute-map.md](dispute-map.md).
2. Read the relevant `key-sections.md` in `knowledge/` (not full statutes unless needed).
3. Cite using dual format: `FCRA §611 (15 U.S.C. §1681i)`.
4. Verify claims against `knowledge/` files before including in any letter.

## Knowledge Base Location

All statutory text lives in `knowledge/`:

| Letter type | Start here |
|-------------|------------|
| Bureau dispute | `knowledge/fcra/key-sections.md` |
| Furnisher dispute | `knowledge/fcra/key-sections.md` (§623) |
| Debt validation | `knowledge/fdcpa/key-sections.md` |
| Cease communication | `knowledge/fdcpa/key-sections.md` (§805(c)) |
| Billing error | `knowledge/usc/15-usc-ch41-subch-i-part-d-fcba.md` |
| Adverse action | `knowledge/fcra/key-sections.md` + `knowledge/usc/15-usc-ch41-subch-iv-ecoa.md` |
| ECOA discrimination | `knowledge/usc/15-usc-ch41-subch-iv-ecoa.md` |

Structured lookup: `knowledge/citations.yaml`  
Human routing: `knowledge/index.md`  
Source provenance: `knowledge/sources.json`

## Citation Rules

- Always use **dual citations** (FCRA/FDCPA section + U.S.C. section).
- Prefer FTC March 2026 FCRA compendium (`knowledge/fcra/ftc-fcra-march-2026.md`) over U.S. Code for FCRA formatting.
- Quote statutory duties accurately; do not paraphrase deadlines or obligations.
- Include applicable time windows: 30 days (FCRA reinvestigation, FDCPA validation), 60 days (FCBA billing error, FCRA adverse-action free report).

## Letter Workflow

```
1. Classify dispute type
2. Read key-sections.md for that statute
3. Map consumer facts to statutory duties in citations.yaml
4. Draft letter citing specific sections and deadlines
5. User reviews and sends (no legal-advice disclaimer inside the mailed body)
```

## Letter layout (print-ready)

Match a formal mailed dispute letter:

- Date, ALL-CAPS consumer name, consumer address, recipient block, `Re:` line, `Dear Sir or Madam:`
- Title Case sections: `Consumer Identification`, `Disputed Tradelines`, `Statutory Reinvestigation Requirements`, `Requested Outcome`
- Per tradeline: bold creditor name, then `Account Number` / `Reported Status` / `Reported Balance` / `Basis of Dispute`
- Use `●` bullets for additional addresses and statutory duty lists
- Close with `Respectfully,` and the consumer name

## Limitations

- **Not legal advice.** User reviews and sends at their own discretion.
- Do not guarantee deletion of tradelines or lawsuit outcomes.
- Do not threaten litigation unless user explicitly requests it.
- State laws may provide additional rights; note when relevant but do not invent state-specific citations.
- Creditors collecting their own debts are generally exempt from FDCPA (third-party collectors only).

## Additional Resources

- Full FCRA: [knowledge/fcra/ftc-fcra-march-2026.md](../../knowledge/fcra/ftc-fcra-march-2026.md)
- Full FDCPA: [knowledge/fdcpa/ftc-fdcpa.md](../../knowledge/fdcpa/ftc-fdcpa.md)
- Dispute routing table: [dispute-map.md](dispute-map.md)
