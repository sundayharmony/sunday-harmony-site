from __future__ import annotations

import os
import re
from pathlib import Path

from app.config import LETTERS_DIR
from app.models import ConsumerInfo, LetterPlan
from app.services.letter_formatter import finalize_letter, normalize_letter_source


def _consumer_name_display(consumer: ConsumerInfo) -> str:
    name = (consumer.name or "[Your Name]").strip()
    return name.upper() if name and not name.startswith("[") else name


def _current_and_prior_addresses(consumer: ConsumerInfo) -> tuple[str, list[str]]:
    addresses = [a.strip() for a in consumer.addresses if a and a.strip()]
    if not addresses:
        return "[Your Address]", []
    return addresses[0], addresses[1:]


def build_letter_prompt(
    plan: LetterPlan,
    consumer: ConsumerInfo,
    intelligence_notes: list[str] | None = None,
) -> str:
    items_block = "\n".join(
        f"- Creditor: {it.creditor}; Account: {it.account_number}; Bureau: {it.bureau}; "
        f"Status: {it.status}; Balance: {it.balance}; Reason: {it.dispute_reason}"
        for it in plan.items
    )
    addr = "\n".join(plan.recipient_lines)
    consumer_addrs = "\n".join(consumer.addresses) if consumer.addresses else "[Consumer address]"
    letter_kind = "credit bureau" if plan.letter_type.startswith("bureau_") else "data furnisher"
    is_bureau = plan.letter_type.startswith("bureau_")
    opening_ask = (
        " at no cost, furnisher notice within five business days under FCRA §611(a)(2), "
        "review of all submitted information, deletion/correction of unverifiable items, "
        "and written results with an updated consumer report if changes are made"
        if is_bureau
        else (
            ", verification under applicable FCRA furnisher duties, "
            "and written confirmation of the outcome"
        )
    )
    intel_block = ""
    if intelligence_notes:
        intel_block = (
            "\n\nCREDIT INTELLIGENCE CONTEXT (use only facts that match the disputed items; "
            "do not invent dates or balances):\n"
            + "\n".join(f"- {n}" for n in intelligence_notes[:20])
        )

    return f"""Draft a formal FCRA dispute letter for a {letter_kind}.

Before writing, read:
- knowledge/fcra/key-sections.md
- knowledge/citations.yaml
- knowledge/credit-intelligence/factor-framework.md

Apply the credit-letter-legal skill conventions. Use dual citations (e.g. {plan.statute}).
Cite legal provisions only when supported by the facts of these accounts.

Recipient:
{plan.recipient_name}
{addr}

Consumer:
Name: {consumer.name}
DOB: {consumer.dob}
SSN last 4: {consumer.ssn_last4}
Addresses (first is current; any others are prior addresses on file):
{consumer_addrs}

Disputed items:
{items_block}
{intel_block}

CLEAN-PROFILE PRIORITY:
- Lead with (and emphasize deletion of) collections, charge-offs, and closed/paid accounts that still show late history or other negatives — these do not help a clean credit profile.
- For those accounts, the primary ask is DELETE the tradeline if unverifiable; correction is only the fallback.
- Do not soft-pedal closed negatives as mere status tweaks.
- Tailor Basis of Dispute language to each account's specific facts (dates, balances, status inconsistencies, possible obsolescence).

FORMAT — match a polished mailed business letter (like a finished Experian dispute PDF):

1) First line: today's date as Month DD, YYYY (e.g. July 24, 2026). Do NOT write "Page X/Y" — pagination is added when printing.
2) Blank line, then consumer full name in ALL CAPS on its own line.
3) Consumer current address on the following lines (street, unit if any, city/state/ZIP). No labels here.
4) Blank line, then recipient name, then recipient address lines.
5) Blank line, then exactly one RE line starting with "Re: " (not "RE:"). Example:
   Re: Formal Dispute of Inaccurate and Unverifiable Credit Report Information – {plan.statute}
6) Blank line, then salutation: "Dear Sir or Madam:"
7) 1–2 short opening paragraphs stating this is a formal dispute under {plan.statute}, requesting a reasonable reinvestigation{opening_ask}.

8) Section heading on its own line (Title Case, NOT ALL CAPS): Consumer Identification
   Then labeled fields (one per line):
   Full Name: ...
   Date of Birth: ...
   Current Address:  (next lines = address, no bullets)
   If more than one consumer address was provided, add:
   Additional Addresses on File:
   ● address one
   ● address two
   (Use a filled circle bullet "●" — not dashes.)

9) Section heading: Disputed Tradelines
   Order accounts so closed, paid, collection, and other obsolete negatives come first.
   For EACH disputed account, use this exact block structure (blank line between accounts):

**Creditor Name Exactly As Given**
Account Number: ...
Reported Status: ...
Reported Balance: ...
Basis of Dispute:
<one or two paragraphs citing {plan.statute} and the consumer's dispute reason. For closed/paid/collection accounts, explicitly request deletion of the entire tradeline if unverifiable. Wrap the creditor name on the first line in **double asterisks** for bold.>

10) Section heading: Statutory Reinvestigation Requirements
    Short intro sentence, then ● bullet list of the recipient's statutory duties (bureau: 30-day reinvestigation, 5-business-day furnisher notice, review of evidence, delete/modify unverifiable data, written results). Cite {plan.statute} and related FCRA sections accurately.

11) Section heading: Requested Outcome
    Lead with deletion: for each disputed tradeline — especially closed, paid, collection, or otherwise obsolete negatives — delete the account if it cannot be verified as accurate and complete. Only alternatively correct inaccurate fields (status, balance, past-due, payment history, delinquency ratings). Ask that written results be mailed to the address above.

12) Closing paragraph thanking them and expecting FCRA compliance.
13) Closing: "Respectfully," then two blank lines, then the consumer's name in normal title/case (not ALL CAPS).

Rules:
- Professional tone suitable for certified mail. No legal-advice disclaimer in the letter body.
- Do NOT use markdown headers (#), numbered lists, or italic *emphasis*. Only **bold** on creditor name lines.
- Use "● " for bullets under Additional Addresses and Statutory Requirements.
- Do NOT invent facts not provided (balances, statuses, addresses, account numbers).
- Do NOT guarantee deletion or score improvement.
- Output ONLY the letter body (no code fences, no commentary).
"""


def _intelligence_notes_for_plan(plan: LetterPlan, report) -> list[str]:
    intel = getattr(report, "credit_intelligence", None)
    if not intel:
        return []
    insights = getattr(intel, "account_dispute_insights", None) or []
    if isinstance(intel, dict):
        insights = intel.get("account_dispute_insights") or []
    by_id = {
        (i.get("tradeline_id") if isinstance(i, dict) else getattr(i, "tradeline_id", "")): i
        for i in insights
    }
    notes: list[str] = []
    for item in plan.items:
        insight = by_id.get(item.tradeline_id)
        if not insight:
            continue
        if isinstance(insight, dict):
            rationale = insight.get("rationale") or ""
            cites = insight.get("legal_citations") or []
            facts = insight.get("supporting_facts") or {}
        else:
            rationale = getattr(insight, "rationale", "")
            cites = getattr(insight, "legal_citations", []) or []
            facts = getattr(insight, "supporting_facts", {}) or {}
        bits = [f"{item.creditor}: {rationale}"]
        if facts.get("date_of_first_delinquency"):
            bits.append(f"DOFD={facts['date_of_first_delinquency']}")
        if facts.get("last_reported"):
            bits.append(f"last_reported={facts['last_reported']}")
        if cites:
            bits.append("cites: " + "; ".join(cites[:3]))
        notes.append(" | ".join(bits))
    return notes


async def generate_letter_async(plan: LetterPlan, consumer: ConsumerInfo, report=None) -> str:
    api_key = os.environ.get("CURSOR_API_KEY", "").strip()
    notes = _intelligence_notes_for_plan(plan, report) if report is not None else []
    prompt = build_letter_prompt(plan, consumer, intelligence_notes=notes or None)
    if api_key:
        try:
            return normalize_letter_source(await _generate_via_sdk_async(prompt))
        except Exception:
            return normalize_letter_source(_template_fallback(plan, consumer))
    return normalize_letter_source(_template_fallback(plan, consumer))


async def _generate_via_sdk_async(prompt: str) -> str:
    from app.services.cursor_client import agent_prompt, result_text

    result = await agent_prompt(prompt)
    text = result_text(result).strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("markdown").strip()
    return text


def generate_letter(plan: LetterPlan, consumer: ConsumerInfo, report=None) -> str:
    api_key = os.environ.get("CURSOR_API_KEY", "").strip()
    notes = _intelligence_notes_for_plan(plan, report) if report is not None else []
    prompt = build_letter_prompt(plan, consumer, intelligence_notes=notes or None)
    if api_key:
        try:
            return normalize_letter_source(_generate_via_sdk(prompt, api_key))
        except Exception:
            return normalize_letter_source(_template_fallback(plan, consumer))
    return normalize_letter_source(_template_fallback(plan, consumer))


def _generate_via_sdk(prompt: str, api_key: str) -> str:
    from app.services.cursor_client import agent_prompt_blocking, result_text

    result = agent_prompt_blocking(prompt)
    text = result_text(result).strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("markdown").strip()
    return text


def _template_fallback(plan: LetterPlan, consumer: ConsumerInfo) -> str:
    today = __import__("datetime").date.today().strftime("%B %d, %Y")
    addr = "\n".join(plan.recipient_lines)
    current_addr, prior_addrs = _current_and_prior_addresses(consumer)
    name_caps = _consumer_name_display(consumer)
    name_sign = (consumer.name or "[Consumer Name]").strip()
    is_bureau = plan.letter_type.startswith("bureau_")
    recipient = plan.recipient_name or "the credit reporting agency"

    prior_block = ""
    if prior_addrs:
        bullets = "\n".join(f"● {a}" for a in prior_addrs)
        prior_block = f"\nAdditional Addresses on File:\n{bullets}"

    item_blocks: list[str] = []
    # Prefer deletion language for closed / obsolete negatives first in the letter body
    ordered_items = sorted(
        plan.items,
        key=lambda it: (
            0
            if re.search(
                r"closed|collection|charge.?off|paid\s*/?\s*closed|delet",
                f"{it.status} {it.dispute_reason}",
                re.I,
            )
            else 1,
            it.creditor.lower(),
        ),
    )
    for it in ordered_items:
        status = it.status or "Not Reported"
        balance = it.balance or "Not Reported"
        reason = (it.dispute_reason or "").strip() or (
            "I dispute this tradeline as inaccurate and unverifiable."
        )
        closed_like = bool(
            re.search(r"closed|collection|charge.?off|paid\s*/?\s*closed", status, re.I)
        )
        if closed_like:
            ask = (
                f"Because this account is reported as {status} and does not support a clean credit "
                f"profile, I specifically request that {recipient} delete the entire tradeline if the "
                f"furnisher cannot verify every reported field. "
            )
        else:
            ask = (
                f"I request that {recipient} delete or correct any information that cannot be verified. "
            )
        item_blocks.append(
            f"**{it.creditor}**\n"
            f"Account Number: {it.account_number or 'Not Reported'}\n"
            f"Reported Status: {status}\n"
            f"Reported Balance: {balance}\n"
            f"Basis of Dispute:\n"
            f"Pursuant to {plan.statute}, I dispute this tradeline as inaccurate and unverifiable. "
            f"{reason} "
            f"{ask}"
            f"Obtain verification from the furnisher pursuant to FCRA §623 (15 U.S.C. §1681s-2)."
        )
    items = "\n\n".join(item_blocks)

    if is_bureau:
        opening = (
            f"I am writing to formally dispute the accuracy and completeness of specific tradelines "
            f"appearing on my {recipient} consumer report. This letter constitutes my formal dispute "
            f"under {plan.statute}.\n\n"
            f"I respectfully request that {recipient} conduct a reasonable reinvestigation at no cost, "
            f"notify the applicable furnishers of each disputed item within five business days as "
            f"required by FCRA §611(a)(2), review all information submitted with this correspondence, "
            f"and delete or correct any information that is inaccurate, incomplete, or cannot be "
            f"verified. Upon completion of the reinvestigation, please provide me with written "
            f"results and an updated copy of my consumer report if any changes are made."
        )
        statutory = (
            f"Pursuant to {plan.statute}, {recipient} is required to:\n"
            f"● Conduct a reasonable reinvestigation, free of charge, and determine the current "
            f"status of each disputed item or delete any information that is inaccurate or cannot "
            f"be verified within the applicable 30-day statutory period.\n"
            f"● Notify each furnisher of the disputed information, including all relevant information "
            f"I have provided, within five business days after receiving this dispute.\n"
            f"● Consider and review all relevant information submitted in connection with this dispute.\n"
            f"● Promptly delete or modify any information determined to be inaccurate, incomplete, "
            f"or unverifiable.\n"
            f"● Provide written notice of the results of the reinvestigation and, if changes are made, "
            f"an updated copy of my consumer report within five business days after the "
            f"reinvestigation is completed.\n\n"
            f"I further request that {recipient} require each furnisher to conduct a reasonable "
            f"investigation under FCRA §623(b) (15 U.S.C. §1681s-2) and remind each furnisher of its "
            f"obligation under FCRA §623(a)(1) not to furnish information that is known or reasonably "
            f"believed to be inaccurate."
        )
        outcome = (
            f"My priority is a clean credit profile. For each disputed tradeline identified above—"
            f"especially collections, charge-offs, and closed or paid accounts that still show "
            f"negative or unverifiable history—I request that {recipient} delete the account in full "
            f"if it cannot be verified as accurate and complete. Only if the account is verified "
            f"should inaccurate fields be corrected, including account status, balance, past-due "
            f"amount, payment history, and delinquency ratings.\n\n"
            f"Please mail your written reinvestigation results and an updated copy of my consumer "
            f"report to the address listed above."
        )
    else:
        opening = (
            f"I am writing to formally dispute the accuracy and completeness of information you are "
            f"furnishing to consumer reporting agencies. This letter constitutes my formal dispute "
            f"under {plan.statute}."
        )
        statutory = (
            f"Pursuant to {plan.statute} and FCRA §623 (15 U.S.C. §1681s-2), you are required to:\n"
            f"● Conduct a reasonable investigation of the disputed information.\n"
            f"● Review all relevant information I have submitted.\n"
            f"● Report the results of your investigation to the consumer reporting agencies to which "
            f"you furnish information.\n"
            f"● Promptly correct or delete any information that is inaccurate, incomplete, or cannot "
            f"be verified, and cease furnishing such information."
        )
        outcome = (
            f"My priority is a clean credit profile. For each disputed tradeline identified above—"
            f"especially closed, paid, collection, or otherwise obsolete negatives—I request that "
            f"you delete the account if it cannot be verified as accurate and complete or, "
            f"alternatively, correct all inaccurate fields and update each consumer reporting "
            f"agency accordingly.\n\n"
            f"Please mail written confirmation of your investigation results to the address listed above."
        )

    return f"""{today}

{name_caps}
{current_addr}

{plan.recipient_name}
{addr}

Re: Formal Dispute of Inaccurate and Unverifiable Credit Report Information – {plan.statute}

Dear Sir or Madam:

{opening}

Consumer Identification
Full Name: {consumer.name or "[Your Name]"}
Date of Birth: {consumer.dob or "Not Provided"}
Current Address:
{current_addr}{prior_block}

Disputed Tradelines

{items}

Statutory Reinvestigation Requirements
{statutory}

Requested Outcome
{outcome}

Thank you for your prompt attention to this matter. I expect full compliance with the Fair Credit Reporting Act and all applicable statutory deadlines.

Respectfully,


{name_sign}
"""


def save_letter_file(session_id: str, plan: LetterPlan, markdown: str) -> Path:
    session_dir = LETTERS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^\w\-]+", "_", plan.recipient_name)[:50]
    rich = normalize_letter_source(markdown)
    path = session_dir / f"{plan.id}_{safe}.letter"
    path.write_text(rich, encoding="utf-8")
    plain_path = path.with_suffix(".txt")
    plain_path.write_text(finalize_letter(rich), encoding="utf-8")
    return path
