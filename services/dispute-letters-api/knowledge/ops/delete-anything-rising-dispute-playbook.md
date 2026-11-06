# “Delete anything” / Rising dispute system — study notes + ops checklist

**Source video:** [Delete ANYTHING From Credit Report FAST (Wish I knew This!)](https://www.youtube.com/watch?v=TdyraLMRAEs)  
**Creator:** Stephen Smith — *Success with Stephen*  
**Related:** [late-payment-cross-bureau-playbook.md](late-payment-cross-bureau-playbook.md)

> **Not legal advice.** Educational ops notes only.

---

## 1. Deep summary

### Goal
Explain why DIY/credit-company disputes often fail, how bureaus process disputes at scale (**e-OSCAR**-style electronic verification), and how **Rising** helps consumers analyze reports, pick dispute reasons, generate personalized letters, track rounds, and (optionally) back-report rent/utilities.

### Core thesis
1. There is no magic sentence that deletes negatives.
2. Bureaus handle huge volume; many disputes are coded/automated and sent to furnishers for verification — generic “verified” replies are common.
3. Weak disputes are vague; strong disputes name **specific reporting defects** (dates, balances, inconsistencies, unverifiable details).
4. Traditional monthly credit-repair shops often recycle weak templates; consumer should retain control with better tooling.
5. Bad credit is expensive (extreme auto-loan APR contrast he lived through).
6. Personalized, report-specific letters + ID packet + certified mail (Rising’s current send path) beat random 2006 templates.
7. Rising may later add in-app send (replacing CFPB/mail dependency); until then: download → certified mail → mark sent → log results → continue rounds.

---

## 2. Everything covered (beat by beat)

### 2.1 Why disputes fail
- Belief in “perfect letter” / secret loophole is wrong.
- Automated dispute pipelines categorize and forward to furnishers quickly.
- Volume example cited: Equifax ~765k disputes/month.
- Outcome often: “verified as accurate” even when consumer believes something is wrong.
- Losing patterns: too generic, too vague, wrong issue targeted, not tied to actual reporting defect.

### 2.2 Better dispute arguments (examples he contrasts)
Weak: “This account is not right.”  
Stronger themes: incorrect reporting dates, missing info, inconsistent balances, unverifiable details, wrong status (e.g. closed vs open), amounts other than balance/past due wrong, credit limit/high balance wrong, payment history wrong, account too old / settled, not my account, etc.

### 2.3 Credit repair company critique
- High monthly fees; slow/little progress for many people.
- Opaque process: unclear customization, prioritization, or full-report analysis.
- Frivolous/generic rounds burn time and money.
- Takeaway: consumer should care more than vendor; need tools, not blind outsourcing.

### 2.4 Rising product walkthrough (as shown)
1. Sign up / $1 7-day trial then ~$39.99/mo (pricing as of recording).
2. Dashboard: credit report review, dispute hub, rental reporting, utility reporting, account, game plan.
3. **Game plan:** choose repair / build / both; score goal; motivation; timeframe.
4. **Report views:** classic tri-merge + interactive; payment-history legend (check, gap, 30/60/90, COL, CO, RPO, FC, VS).
5. **Manual dispute flow:** pick account → start dispute → times previously disputed → select reason(s) or custom verbiage → preview which bureaus → draft → generate letters → download.
6. **Packet instructions Rising shows:** dispute letter + photo ID + SSN proof + proof of residency (+ screenshots for factual disputes).
7. Letter auto-fills name/address/DOB/SSN + bureau address; round counter (“dispute number 1”); ask delete/update within 30 days.
8. **Tracking:** mark as sent (certified + date); log result (updated vs verified); successful → completed; declined → continue next round.
9. **Rental reporting:** up to 24 months back-report positive only; bank connect + verify; never reports negatives.
10. **Utility reporting:** power/gas/water/phone; positive only; late months simply omitted.
11. Extra tips in-app: CLI guidance, authorized user education, VIP card offers.
12. Positioning vs MyFICO-style monitoring: Rising bundles monitoring + disputes + build features.

### 2.5 Round philosophy (aligned with his other videos)
- Round 1–3 process still applies.
- Charge-off example: Round 1 = initial investigation ask.
- Keep evidence packet consistent every round.

---

## 3. Map to Sunday Harmony

| Video idea | In product today? | Notes |
|------------|-------------------|-------|
| Analyze full report / find dispute opportunities | **Yes** | Credit Intelligence + AI analyze + staff selection |
| Personalized FCRA letters (not random templates) | **Yes** | Python letter generator + legal knowledge base |
| Multi-bureau plans | **Yes** | EQF/EXP/TUC (+ furnisher) |
| Round tracking / mark sent / outcomes | **Yes (partial)** | Lifecycle rounds, statuses, packages; mail UI thinner than Rising’s mark-sent UX |
| ID + address enclosures in DOCX | **Yes** | Auto when docs on file |
| DOB/SSN on letter | **Yes** | Full SSN when application linked |
| Payment-history legend / month grid UI | **No** | No structured grid; freeform/AI only |
| Rising-style reason picker UI | **Partial** | Staff choose dispute_reason; not Rising’s guided reason taxonomy |
| Consumer self-serve Rising competitor | **No** | Staff-driven admin workflow (+ client portal for released rounds/replies) |
| Rental/utility back-reporting | **No** | Outside product |
| In-app certified mail / auto-mail | **No** | Generate ZIP; staff mails |
| e-OSCAR education for staff | **No dedicated UI** | Ops knowledge only (this doc) |

### Hybrid workflow
Use **Sunday Harmony** as the case system of record (client file, letters, rounds, CFPB drafts).  
Use **Rising** (if client/staff chooses) for tri-merge viewing, month grids, rental/utility reporting, or parallel dispute drafting — then **mirror outcomes** into Sunday Harmony lifecycle statuses.

---

## 4. MANUAL checklist (website does not fully handle)

- [ ] **MANUAL** Decide whether client uses Rising, ACR.com, IdentityIQ, or combination.
- [ ] **MANUAL** Read payment-history grids / legends; identify concrete defects (not “this looks wrong”).
- [ ] **MANUAL** Prioritize which accounts first (high-impact negatives before busywork).
- [ ] **MANUAL** If using Rising: generate/download letters OR copy customized reasons into Sunday Harmony confirm/generate path.
- [ ] **MANUAL** Assemble packet: letter + photo ID + SSN card + proof of residency + factual screenshots.
- [ ] **MANUAL** Send certified; record tracking; mark sent in product.
- [ ] **MANUAL** Log bureau results per bureau (updated vs verified) into lifecycle.
- [ ] **MANUAL** On verified: escalate to Round 2 MOV / warning / reinvestigation in product.
- [ ] **MANUAL** Rental/utility back-reporting entirely outside Sunday Harmony.
- [ ] **MANUAL** Do not promise deletions; Rising/Sunday Harmony are tools, not guarantees.
- [ ] **MANUAL** Avoid frivolous/generic mass disputes that invite “frivolous” findings.

### Product does not
1. Replace Rising’s interactive month-grid dispute UX.
2. Auto-mail letters from the website.
3. Back-report rent/utilities.
4. Guarantee e-OSCAR outcomes.
5. Run consumer DIY credit repair as a self-serve Rising clone.

---

## 5. Optional product backlog
- Richer dispute-reason taxonomy aligned to reporting defects.
- Payment-history grid + defect tags.
- Stronger “mark sent / log result” UX matching Rising’s loop.
- Staff note field: “external tool = Rising” for dual-tracking.

## Source
https://www.youtube.com/watch?v=TdyraLMRAEs
