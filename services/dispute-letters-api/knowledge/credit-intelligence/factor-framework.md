# Credit Intelligence Factor Framework

Original synthesis for Sunday Harmony analysis workflows. Concepts drawn from
CFPB credit education, FTC dispute guidance, myFICO scoring education, bureau
consumer education, and FCRA reporting/dispute provisions. Not legal advice.
Do not copy source text into consumer-facing letters.

## Score factor lens (educational weights)

Typical consumer-facing FICO-style factor framing used for *prioritization*,
not for computing a proprietary score:

| Factor | Approx. weight | What we analyze |
|--------|----------------|-----------------|
| Payment history | ~35% | Lates, severity, frequency, age, on-time pattern |
| Amounts owed | ~30% | Revolving utilization (individual + aggregate), balances vs limits |
| Length of history | ~15% | Oldest, newest, average age of accounts |
| New credit | ~10% | Hard inquiries (age, count, clustering) |
| Credit mix | ~10% | Revolving, installment, mortgage, auto, student, personal |

Guidelines (CFPB / industry education, not guarantees):

- On-time payments are the highest-leverage positive behavior.
- Keeping revolving use well below limits (commonly cited ~30% or lower) reduces
  utilization pressure.
- A longer clean history generally supports stronger profiles.
- Clusters of hard inquiries can signal elevated new-credit risk.
- Closing cards can shrink available credit and raise utilization.

## Derogatory aging (FCRA §605 / 15 U.S.C. §1681c)

Use for *obsolescence screening* when dates are present:

- Most adverse items: generally 7 years from the qualifying event.
- Accounts placed for collection or charged off: reporting window commonly
  measured from date of first delinquency that led to collection/charge-off,
  with statutory 180-day adjustment (≈7 years + 180 days).
- Bankruptcy cases: up to 10 years from filing (bureau practice may remove
  Chapter 13 earlier; do not promise removal dates).
- Do not treat re-aged DOFD as legitimate clock resets.

When dates are missing, flag for manual review — do not invent DOFD.

## Dispute posture (FCRA §611 / §623; FTC/CFPB process)

Recommend dispute only when facts support inaccuracy, incompleteness,
unverifiability, or obsolete reporting — or when the specialist elects a
deletion-focused challenge consistent with client goals.

- Cite §611 (15 U.S.C. §1681i) for CRA reinvestigation duties.
- Cite §623 (15 U.S.C. §1681s-2) when addressing furnishers.
- Prefer factual, account-specific language; attach supporting docs when available.
- Never guarantee deletion, score lift, or lender approval.

## Funding readiness lens

Combine report factors with intake (goals, business profile, self-attested flags):

| Signal | Typical concern |
|--------|-----------------|
| High revolving utilization | May constrain revolving / unsecured approvals |
| Thin file | Limited tradelines for underwriting |
| Recent delinquencies / collections | Elevated default risk signal |
| Inquiry surge | Recent credit-seeking pressure |
| Strong on-time history | Supportive for lenders |
| Short business history / weak revenue data | Business funding readiness drag |
| High DTI (when income + debt known) | Capacity concern |

Always frame as readiness *indicators*, never as approval predictions.

## Recommendation ranking

Score each recommendation by:

1. **Estimated impact** — how much it may move score factors or funding optics
2. **Confidence** — quality of underlying data (limits present, dates present, etc.)
3. **Urgency** — obsolete negatives, active collections, maxed cards
4. **Sequence** — e.g. reduce utilization / stabilize payments before new apps;
   dispute inaccurate/obsolete items in parallel when appropriate
