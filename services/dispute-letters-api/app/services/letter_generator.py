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


def build_letter_prompt(plan: LetterPlan, consumer: ConsumerInfo) -> str:
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

    return f"""Draft a formal FCRA dispute letter for a {letter_kind}.

Before writing, read:
- knowledge/fcra/key-sections.md
- knowledge/citations.yaml

Apply the credit-letter-legal skill conventions. Use dual citations (e.g. {plan.statute}).

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
   For EACH disputed account, use this exact block structure (blank line between accounts):

**Creditor Name Exactly As Given**
Account Number: ...
Reported Status: ...
Reported Balance: ...
Basis of Dispute:
<one or two paragraphs citing {plan.statute} and the consumer's dispute reason; request reinvestigation / verification / delete-or-correct. Wrap the creditor name on the first line in **double asterisks** for bold.>

10) Section heading: Statutory Reinvestigation Requirements
    Short intro sentence, then ● bullet list of the recipient's statutory duties (bureau: 30-day reinvestigation, 5-business-day furnisher notice, review of evidence, delete/modify unverifiable data, written results). Cite {plan.statute} and related FCRA sections accurately.

11) Section heading: Requested Outcome
    One tight paragraph stating delete if unverifiable, else correct inaccurate fields (status, balance, past-due, payment history, delinquency ratings). Ask that written results be mailed to the address above.

12) Closing paragraph thanking them and expecting FCRA compliance.
13) Closing: "Respectfully," then two blank lines, then the consumer's name in normal title/case (not ALL CAPS).

Rules:
- Professional tone suitable for certified mail. No legal-advice disclaimer in the letter body.
- Do NOT use markdown headers (#), numbered lists, or italic *emphasis*. Only **bold** on creditor name lines.
- Use "● " for bullets under Additional Addresses and Statutory Requirements.
- Do NOT invent facts not provided (balances, statuses, addresses, account numbers).
- Output ONLY the letter body (no code fences, no commentary).
"""


async def generate_letter_async(plan: LetterPlan, consumer: ConsumerInfo) -> str:
    api_key = os.environ.get("CURSOR_API_KEY", "").strip()
    prompt = build_letter_prompt(plan, consumer)
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


def generate_letter(plan: LetterPlan, consumer: ConsumerInfo) -> str:
    api_key = os.environ.get("CURSOR_API_KEY", "").strip()
    prompt = build_letter_prompt(plan, consumer)
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
    for it in plan.items:
        status = it.status or "Not Reported"
        balance = it.balance or "Not Reported"
        reason = (it.dispute_reason or "").strip() or (
            "I dispute this tradeline as inaccurate and unverifiable."
        )
        item_blocks.append(
            f"**{it.creditor}**\n"
            f"Account Number: {it.account_number or 'Not Reported'}\n"
            f"Reported Status: {status}\n"
            f"Reported Balance: {balance}\n"
            f"Basis of Dispute:\n"
            f"Pursuant to {plan.statute}, I dispute this tradeline as inaccurate and unverifiable. "
            f"{reason} "
            f"I request that {recipient} conduct a reasonable reinvestigation, obtain verification "
            f"from the furnisher pursuant to FCRA §623 (15 U.S.C. §1681s-2), and delete or correct "
            f"any information that cannot be verified."
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
            f"For each disputed tradeline identified above, I request that {recipient} delete the "
            f"account if it cannot be verified as accurate and complete or, alternatively, correct "
            f"all inaccurate fields—including account status, balance, past-due amount, payment "
            f"history, and delinquency ratings—to reflect verified information supported by the "
            f"furnisher's records.\n\n"
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
            f"For each disputed tradeline identified above, I request that you delete the account if "
            f"it cannot be verified as accurate and complete or, alternatively, correct all "
            f"inaccurate fields and update each consumer reporting agency accordingly.\n\n"
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
