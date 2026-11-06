# Late-payment cross-bureau method — study notes + ops checklist

**Source video:** [How To Delete Late Payments From Credit Report FAST NO LETTER (2026)](https://www.youtube.com/watch?v=-w1LNruKvPY)  
**Creator:** Stephen Smith — *Success with Stephen*  
**Studied for:** Sunday Harmony Credit Intelligence / Dispute Letters workflow  
**Purpose:** Capture everything the video teaches, map it to what our website already does, and list what staff must still do **outside** the product.

> **Not legal advice.** Educational ops notes only. Staff review every complaint and letter before sending. Outcomes are never guaranteed.

---

## 1. What the video is about (deep summary)

### Goal
Remove or update **late payments** on a consumer’s credit file when payment history is **inaccurate or inconsistent across Equifax, Experian, and TransUnion** — without goodwill letters and without calling.

### Core thesis
1. On-time payment history is the largest score factor (~**35%**).
2. One **30-day late** can drop a strong score by roughly **~100 points** and can remain for up to **7 years**.
3. Consumer reporting must be **accurate and consistent**. Conflicting month-level histories across bureaus are a **reasonable basis** to demand investigation/correction under the **FCRA** (especially furnisher accuracy duties).
4. The consumer does **not** carry the full burden of proof. They must identify what is wrong and give a **reasonable basis** (not a bare allegation). Screenshots / circled report excerpts are the “show, don’t only say” evidence.
5. Portals change. **Certified mail letters** remain the durable fallback forever.
6. Prefer the **CFPB complaint portal** when available as the delivery channel; treat CFPB like a **post office** — it routes the dispute; it does not give real-time dispute status the way a monitoring app does.

### Method at a glance

```
Pull clean 3-bureau view
  → Find same account / same month reported differently across bureaus
  → Circle / screenshot the mismatch
  → Dispute ONE late month at a time (two max)
  → Ask the “wrong” bureau to update to paid on time / never late
  → After that bureau corrects, flip the argument to the other bureaus
  → Prefer CFPB portal (or certified letters)
  → Attach ID + SSN card + proof of address + circled screenshots
  → If “verified,” follow up with reinvestigation / method of verification
```

---

## 2. Everything the video covered (beat by beat)

### 2.1 Why late payments matter
- Payment history ≈ 35% of score.
- A single 30-day late can cause a large score hit (~100 points cited).
- Late history can remain ~7 years.
- Worth fixing early; tedious when done month-by-month.

### 2.2 Get the right report view
| Source | Why he recommends it | Notes from video |
|--------|----------------------|------------------|
| **annualcreditreport.com** | Only federally authorized free 3-bureau source | Pull often (he cites weekly at recording time; subject to change). Best for fuller payment history grids. |
| **Rising.com** (paid trial) | Triggered / combined 3-bureau view + monitoring | Easier to compare one account across bureaus and get dispute notifications. Screenshot then cancel if only needed briefly. |

**Goal:** a clean, readable payment-history view for the account you will dispute.

### 2.3 Find the inconsistency (the “play”)
Example pattern he walks through:
- **Feb 2020:** TransUnion late 30, Experian late 30, Equifax **on time**
- **Jan 2020:** TransUnion/Experian on time, Equifax **late 30**

That conflict is the dispute fuel:
> “Two bureaus show paid on time for this month; one does not. Update the inaccurate bureau.”

White gaps in monitoring UIs are normal; ACR.com often shows fuller history. Circle the mismatched months on screenshots.

### 2.4 Sequencing (critical)
1. Dispute the bureau that looks **wrong** first (e.g. Equifax shows late; others on time).
2. When that bureau updates to on time, use **that corrected report** against Experian/TransUnion for months they still show late.
3. Do **one late month at a time**. Two is the absolute max; he says more reduces success rate.
4. Repeat month by month — effective but tedious.
5. He notes a separate future method when **no** cross-bureau inconsistency exists (not detailed in this video).

### 2.5 FCRA framing he emphasizes
He walks FTC.gov FCRA text, focusing on **furnisher responsibilities**:
- Duty to provide accurate information.
- Do not furnish info you know or have **reasonable cause to believe** is inaccurate.
- After notice that specific info is inaccurate, do not keep furnishing inaccurate info.
- “Reasonable cause” = specific knowledge beyond bare consumer allegation that would make a reasonable person doubt accuracy → **screenshots of conflicting bureau histories** qualify in his method.
- Mentions other FCRA topics as related toolkit (identity theft blocks, trafficking, investigative disclosures / method-of-verification style asks, COVID covered-period reporting limits) — COVID path was an older idea he could no longer re-test personally because his lates were gone.
- Stress: no secret “hack.” Read the statute, interpret carefully, try, iterate. Use AI to help interpret statute language if needed, then verify yourself.

### 2.6 CFPB portal steps (as he demonstrates)
1. Go to **consumerfinance.gov** → Start a new complaint (account required).
2. Category path he uses: **Credit reporting** → credit reporting → problem type **Improper use of your report** → **Reporting company used your report improperly**.
3. “Already tried to fix with the company?” → **Yes**.
4. “Did you request information?” → **Yes** — e.g. “statement proving I was late on my account.”
5. “Did company provide it?” → **No**.
6. **What happened** narrative (customize; don’t paste identical spam):
   - Reviewed report; account not reporting accurately.
   - Late payment was in fact paid on time.
   - CRAs must report with complete accuracy.
   - Attach report; list month/year(s).
   - Demand update to **paid on time / paid never late**.
   - Cite knowledge of errors / substantial doubts about accuracy.
   - Explicitly name the bureau conflict (e.g. “Equifax shows on time; TransUnion shows late”).
7. **Fair resolution:** update the specific late to paid on time / never late.
8. **Attachments (required in his process):**
   - Driver’s license / government photo ID
   - Social Security card
   - Proof of residency / current address
   - Screenshots of the accounts / circled inconsistencies
9. **Personal info hygiene first:** remove old addresses; make license, proof of address, and credit-file current address match.
10. Prefer **bureau-specific** complaints when the narrative is aimed at one bureau; don’t lazily blast identical wording to all three unless the text truly applies to all.
11. Enter last 4 SSN, DOB, name as on the credit report; review; submit.
12. Expect email that complaint was sent to the company. CFPB may say ~60 days; **bureau responses often come faster (~7 days common in his experience; up to ~30 possible)**.
13. Track outcomes via monitoring app, mail, or legal notification — **not** by refreshing CFPB as a live case tracker.
14. If verified / no change → follow-up video path: **reinvestigation + proof / method of verification**.

### 2.7 Certified-mail fallback
If CFPB portal options change, funding is constrained, or submission fails: **send the same substance by certified mail**. The legal rights do not depend on the portal existing.

### 2.8 What he explicitly is *not* doing in this video
- Goodwill letters
- Phone calls to creditors
- Guaranteeing deletion every time
- A full method for “all three bureaus agree the late is real” (promised as a later video)
- Treating CFPB as the investigator of record instead of a delivery channel

---

## 3. How this maps to the Sunday Harmony system

### 3.1 What the website **already supports** (use the product)

| Video idea | Product support today | Where |
|------------|----------------------|--------|
| Tri-bureau report analysis | Upload IdentityIQ / credit PDF → analyze → tradelines + Credit Intelligence | Admin Dispute Letters / Credit & Funding Under Review |
| Flag late / derogatory accounts | AI + heuristics tag late payments, collections, charge-offs; payment-history factor (~35% educational) | Health / Credit Intelligence dashboard |
| FCRA bureau dispute letters | Round 1 `bureau_equifax` / `bureau_experian` / `bureau_transunion` with §611 framing | Letter generate + ZIP |
| Furnisher accuracy duties | `furnisher` letters under §623 | Letter router |
| Method of verification / reinvestigation follow-ups | Round 2+ suggests `method_of_verification`, `warning_intent`, `reinvestigation` | Lifecycle + letter types |
| CFPB escalation **draft** | In-app markdown draft + optional `cfpb_complaint` letter type; status draft→submitted→… | Dispute Rounds panel + lifecycle CFPB API |
| Identity enclosures on mailed letters | Photo ID + proof of address pulled into DOCX when on file; listed under Enclosures | Letter identity attachments |
| DOB + full SSN on letter identity block | Opening block + Consumer Identification | Letter generator |
| Round tracking / prior disputes / new-report comparison | Cases, rounds, item statuses, deleted vs verified vs updated | Dispute lifecycle |
| Certified-mail ops fields | mail method, tracking, deadlines, packet checklist (DB) | Lifecycle (UI still thin for some fields) |
| Client reply uploads | Client portal for released rounds | Client Dispute panel |
| Store CFPB portal credentials from intake | Encrypted on application; staff reveal when needed | Credit funding intake / admin |

### 3.2 What the website **partially** supports (use carefully)

| Video idea | Partial support | Gap |
|------------|-----------------|-----|
| Cross-bureau inconsistency | AI may emit freeform `payment_history` text / `late_payment_error` / `balance_mismatch` | **No structured month grid** (OK/30/60/90 × bureau). No auto “Feb 2020 late on EQF only” detector |
| One-item focus in later rounds | Round ≥2 forces **one tradeline per bureau letter** | Still not “one **late month cell**” as a first-class dispute unit |
| CFPB complaint narrative | Draft generator + editable markdown | Does **not** fill consumerfinance.gov forms or click portal steps |
| Address hygiene | Confirm step lets staff edit addresses before generate | System **defaults to listing prior addresses** as “Additional Addresses on File” — opposite of “strip old addresses” unless staff edits |
| Evidence screenshots | Staff can keep files in credit-funding docs / session | No “circle this month” annotation tool; screenshots not auto-packaged into CFPB portal upload |
| COVID-era late rules | Statute text may exist in FCRA knowledge corpus | **No** product flag or letter subtype for COVID covered periods |
| Score impact education | Factor framework / recommendations mention ~35% | No point-drop calculator for removing one late |

### 3.3 What the website is **not built to handle** (manual staff work)

See **Section 4** — this is the operational checklist for humans.

### 3.4 Recommended hybrid workflow (video method + our product)

```
A. Prep (manual)
   Pull ACR.com and/or Rising → find mismatched late months → circle screenshots
   Clean personal info (current address match on ID / proof / file)
   Upload IdentityIQ or PDF into Sunday Harmony for the case

B. In product
   Run analyze / Credit Intelligence
   Select ONLY the account(s) tied to the late month you are fighting now
   Prefer Round 1 bureau letter OR use CFPB draft for portal filing
   Generate letters / ZIP when mailing; confirm package sent; track round

C. CFPB path (manual portal)
   Use in-app CFPB draft as starting copy
   Customize per bureau
   File on consumerfinance.gov with ID + SSN card + proof + circled screenshots
   Mark escalation status in product when submitted / responded

D. After response
   Pull fresh report → upload / compare in product
   If corrected: flip sequence to other bureaus for remaining mismatched months
   If verified: generate MOV / reinvestigation follow-up in product
   Only then move to the next late month
```

---

## 4. Manual ops checklist — outside the website

Use this every time you run the Stephen Smith late-payment inconsistency method.  
**Anything marked MANUAL is not automated by Sunday Harmony today.**

### Before dispute
- [ ] **MANUAL** Pull fresh reports from annualcreditreport.com (and/or Rising) the day you dispute.
- [ ] **MANUAL** Open payment history for the target account on all three bureaus.
- [ ] **MANUAL** Find months where bureaus disagree (late vs on-time).
- [ ] **MANUAL** Circle / highlight those months and save clear screenshots/PDFs.
- [ ] **MANUAL** Choose **one** late month to fight first (two max).
- [ ] **MANUAL** Confirm personal info matches: legal name, DOB, current address on license, proof of address, and credit file. Remove or stop using stale addresses for this packet.
- [ ] **MANUAL** Have ready: photo ID, Social Security card (or acceptable SSN proof), proof of current residency.
- [ ] In product: ensure credit-funding docs (photo ID + proof of address) are uploaded so mailed letters can enclose them.
- [ ] In product: link dispute session to the application; upload the working report for analysis.

### Choosing channel
- [ ] Prefer **CFPB portal** when available for this method (video’s primary path).
- [ ] Use **product letter ZIP + certified mail** when portal is unavailable, blocked, or you want a parallel paper trail.
- [ ] **MANUAL** Do not rely on goodwill letters or phone calls for this specific method.

### CFPB portal filing (MANUAL end-to-end)
- [ ] **MANUAL** Log into consumerfinance.gov (use client’s portal credentials from intake only with proper authorization / process).
- [ ] **MANUAL** Start complaint → Credit reporting → improper use / company used report improperly (path as in video; confirm UI still matches — portals change).
- [ ] **MANUAL** Answer “already contacted company / requested info / not provided” consistently with your packet.
- [ ] Paste/customize narrative from product CFPB draft; **rewrite per bureau** when targeting one bureau’s mismatch.
- [ ] **MANUAL** State the exact month/year and which bureau is wrong vs which show paid on time.
- [ ] **MANUAL** Upload ID, SSN card, proof of residency, circled screenshots.
- [ ] **MANUAL** Enter name/DOB/SSN last4 as on the credit report; review; submit.
- [ ] In product: mark CFPB escalation `submitted` and note date / complaint reference if available.
- [ ] **MANUAL** Monitor Rising / ACR refreshes / mail — do not wait on CFPB dashboard as live status.

### Mail path (when used)
- [ ] In product: generate bureau (and furnisher if needed) letters for the selected account only.
- [ ] **MANUAL** Edit Confirm-step addresses if you do **not** want prior addresses listed.
- [ ] **MANUAL** Optionally add or attach circled payment-history screenshots beyond the default ID/address enclosures.
- [ ] Download ZIP / print; send certified; record tracking in lifecycle fields.
- [ ] Confirm package sent in product.

### After results
- [ ] **MANUAL** Re-pull reports; verify the specific month updated.
- [ ] In product: upload new report; let comparison mark deleted/updated/verified where possible; adjust item statuses.
- [ ] If success on bureau A: **MANUAL** prepare next complaint/letter flipping the argument to bureaus B/C for remaining mismatched months.
- [ ] If verified / no change: in product generate **method of verification** / reinvestigation follow-up; **MANUAL** send via portal or mail.
- [ ] Only then start the **next** late month.
- [ ] **MANUAL** If all three bureaus agree the late is accurate, stop this method — use a different strategy (not covered by this video).

### Do not expect the website to
1. Auto-detect month-level payment-history mismatches across bureaus.
2. Limit disputes to a single late **month cell** as a data object.
3. Circle screenshots or build a CFPB evidence binder automatically.
4. Fill or submit the CFPB website forms.
5. Strip old addresses from the credit file at the bureaus.
6. Write goodwill letters or phone scripts for this method.
7. Apply COVID covered-period rules automatically.
8. Guarantee score increases or deletion timelines.
9. Replace certified-mail judgment when portals fail.
10. Replace staff review of every complaint narrative.

---

## 5. Product gaps worth building later (optional backlog)

Prioritized for aligning the product with this playbook:

1. **Structured payment-history grid** per tradeline × bureau × month (`OK` / `30` / `60` / `90` / blank).
2. **Mismatch detector** that lists “month M late on EQF, OK on EXP/TUC.”
3. **Dispute unit = late month** (not only whole tradeline), with suggested one-at-a-time queue.
4. **CFPB packet export** (PDF/ZIP): draft narrative + identity docs + staff-uploaded circled screenshots checklist.
5. Confirm-step toggle: **omit prior addresses** for CFPB-style packets.
6. Ops UI for mail tracking numbers / packet checklist (fields exist; form is thin).
7. Optional COVID covered-period reason flag when dates fall in statutory windows (cite knowledge base; never invent).

---

## 6. Quick reference — video vs Sunday Harmony

| Step | Video | Sunday Harmony |
|------|-------|----------------|
| Get reports | ACR / Rising | Upload whatever staff pulls (IdentityIQ/PDF best supported) |
| Find bad late month | Manual eyes on grid | Manual (AI may hint; no grid UI) |
| Evidence | Circled screenshots | Manual attach; letters auto-enclose ID/address |
| Send | CFPB portal first | Draft in-app; **portal filing manual**; or mail ZIP |
| One at a time | One month | Staff discipline; Round 2+ one tradeline/bureau letter |
| Follow-up | MOV / reinvestigate | Built-in letter types + rounds |
| Track | Rising + mail | Rounds, statuses, optional CFPB escalation row |

---

## 7. Source

- YouTube: https://www.youtube.com/watch?v=-w1LNruKvPY  
- Title: *How To Delete Late Payments From Credit Report FAST NO LETTER (2026)*  
- Channel: Success with Stephen (Stephen Smith)

When portal UIs or CFPB funding/process change, update **Section 2.6** and the manual checklist — the FCRA accuracy/consistency idea and certified-mail fallback are the durable parts.
