from __future__ import annotations

import asyncio
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


def _format_ssn_for_letter(consumer: ConsumerInfo) -> str:
    """Format SSN for mailed dispute letters. Prefer full 9-digit SSN when available."""
    raw = (consumer.ssn or consumer.ssn_last4 or "").strip()
    if not raw:
        return "Not Provided"
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 9:
        return f"{digits[:3]}-{digits[3:5]}-{digits[5:]}"
    if len(digits) >= 4:
        return f"XXX-XX-{digits[-4:]}"
    return raw


def _format_dob_for_letter(consumer: ConsumerInfo) -> str:
    return (consumer.dob or "").strip() or "Not Provided"


def _identity_header_lines(consumer: ConsumerInfo) -> str:
    """DOB + SSN directly under the consumer address at the top of the letter."""
    return (
        f"Date of Birth: {_format_dob_for_letter(consumer)}\n"
        f"Social Security Number: {_format_ssn_for_letter(consumer)}"
    )


_DISPUTE_OPENER_RE = re.compile(
    r"\bi\s+dispute(?:\s+this\s+tradeline)?\s+as\s+inaccurate\s+and\s+unverifiable\b",
    re.I,
)
_STATUTE_611_RE = re.compile(
    r"(?:pursuant\s+to|under)\s+(?:fcra\s*)?§?\s*611\b|15\s*u\.?\s*s\.?\s*c\.?\s*§?\s*1681i\b",
    re.I,
)
_DELETE_ASK_RE = re.compile(r"\b(?:delet(?:e|ion|ing)|remov(?:e|al)|correct)\b", re.I)
_FURNISHER_623_RE = re.compile(
    r"§\s*623\b|1681s-2|obtain verification from the furnisher|furnisher investigation",
    re.I,
)
_CLEAN_PROFILE_ASK_RE = re.compile(
    r"[^.]*\bclean credit profile\b[^.]*\.",
    re.I,
)


def _normalize_basis_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _split_basis_sentences(text: str) -> list[str]:
    """Split on sentence boundaries without breaking U.S.C. / FCRA § cites."""
    protected: list[str] = []

    def _stash(match: re.Match[str]) -> str:
        protected.append(match.group(0))
        return f"«{len(protected) - 1}»"

    # Keep common legal abbreviations intact through the sentence splitter.
    masked = re.sub(r"\bU\.S\.C\.", _stash, text, flags=re.I)
    masked = re.sub(r"\bP\.O\.", _stash, masked, flags=re.I)
    parts = re.split(r"(?<=[.!?])\s+", masked)
    restored: list[str] = []
    for part in parts:
        sentence = part.strip()
        if not sentence:
            continue
        for index, original in enumerate(protected):
            sentence = sentence.replace(f"«{index}»", original)
        restored.append(sentence)
    return restored


_LEADING_611_RE = re.compile(
    r"^(?:pursuant\s+to|under)\s+(?:fcra\s*)?§?\s*611(?:\s*\([^)]*\))?\s*,?\s*",
    re.I,
)


def _collapse_duplicate_sentences(text: str) -> str:
    """Drop exact duplicates and repeated statute openers while keeping order."""
    kept: list[str] = []
    seen: set[str] = set()
    saw_dispute_opener = False
    saw_611 = False
    saw_623 = False
    for part in _split_basis_sentences(_normalize_basis_whitespace(text)):
        sentence = part if part[-1:] in ".!?" else f"{part}."
        lower = sentence.lower()
        if _DISPUTE_OPENER_RE.search(lower):
            if saw_dispute_opener:
                continue
            saw_dispute_opener = True
        if _FURNISHER_623_RE.search(lower):
            if saw_623:
                continue
            saw_623 = True
        if _STATUTE_611_RE.search(lower):
            if saw_611:
                # Keep the substance; drop a second "Pursuant to/Under FCRA §611..." lead-in.
                stripped = _LEADING_611_RE.sub("", sentence).strip()
                if not stripped or len(stripped) < 8:
                    continue
                sentence = stripped[0].upper() + stripped[1:] if stripped[0].islower() else stripped
                if sentence[-1:] not in ".!?":
                    sentence += "."
                lower = sentence.lower()
            saw_611 = True
        key = re.sub(r"\s+", " ", lower).strip()
        if key in seen:
            continue
        seen.add(key)
        kept.append(sentence)
    return " ".join(kept).strip()


def compose_basis_of_dispute(
    *,
    recipient: str,
    statute: str,
    status: str,
    reason: str,
) -> str:
    """One concise Basis of Dispute paragraph — no stacked openers or duplicate FCRA asks."""
    body = _CLEAN_PROFILE_ASK_RE.sub(" ", reason or "")
    body = _normalize_basis_whitespace(body)
    body = _collapse_duplicate_sentences(body)

    if not body:
        body = (
            f"I dispute this tradeline as inaccurate and unverifiable under {statute} "
            f"and request that {recipient} delete or correct any information that cannot be verified."
        )

    lower = body.lower()
    has_dispute = bool(_DISPUTE_OPENER_RE.search(lower) or re.search(r"\bi dispute\b", lower))
    has_611 = bool(_STATUTE_611_RE.search(lower) or (statute and statute.lower() in lower))
    has_delete = bool(_DELETE_ASK_RE.search(lower))
    has_623 = bool(_FURNISHER_623_RE.search(lower))

    pieces: list[str] = []
    if not has_dispute and not has_611:
        pieces.append(
            f"Pursuant to {statute}, I dispute this tradeline as inaccurate and unverifiable."
        )
    elif not has_dispute and has_611:
        pieces.append("I dispute this tradeline as inaccurate and unverifiable.")

    pieces.append(body.rstrip(". ") + ".")

    if not has_delete:
        closed_like = bool(
            re.search(r"closed|collection|charge.?off|paid\s*/?\s*closed", status or "", re.I)
        )
        if closed_like:
            pieces.append(
                f"I request that {recipient} delete the entire tradeline if the furnisher cannot "
                f"verify every reported field as accurate and complete."
            )
        else:
            pieces.append(
                f"I request that {recipient} delete or correct any information that cannot be verified."
            )

    if not has_623:
        pieces.append(
            "Obtain verification from the furnisher pursuant to FCRA §623 (15 U.S.C. §1681s-2)."
        )

    return _collapse_duplicate_sentences(" ".join(pieces))


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
    letter_kind = (
        "credit bureau"
        if plan.letter_type.startswith("bureau_")
        or plan.letter_type
        in {
            "method_of_verification",
            "warning_intent",
            "reinvestigation",
            "cfpb_complaint",
        }
        else "data furnisher"
        if plan.letter_type in {"furnisher", "debt_validation"}
        else "recipient"
    )
    is_bureau = plan.letter_type.startswith("bureau_") or plan.letter_type in {
        "method_of_verification",
        "warning_intent",
        "reinvestigation",
    }
    if plan.letter_type == "method_of_verification":
        opening_ask = (
            ", disclosure of the method of verification used under FCRA §611(a)(6)-(7), "
            "the name and contact information of any person contacted to verify the information, "
            "and deletion of any item that cannot be verified"
        )
    elif plan.letter_type == "warning_intent":
        opening_ask = (
            ", completion of the overdue reinvestigation, written results, "
            "and notice that continued noncompliance may result in further escalation including "
            "a complaint to the Consumer Financial Protection Bureau and civil remedies under "
            "FCRA §616 and §617"
        )
    elif plan.letter_type == "reinvestigation":
        opening_ask = (
            ", a fresh reasonable reinvestigation of the updated or remaining inaccurate data, "
            "deletion or correction of unverifiable fields, and written results"
        )
    elif plan.letter_type == "debt_validation":
        opening_ask = (
            ", validation of the alleged debt under FDCPA §809, identification of the original "
            "creditor, and cessation of collection activity until validation is provided"
        )
    elif plan.letter_type == "cfpb_complaint":
        opening_ask = (
            ", supervisory attention to the unresolved FCRA / FDCPA violations described below, "
            "and written confirmation of the agency response"
        )
    elif is_bureau:
        opening_ask = (
            " at no cost, furnisher notice within five business days under FCRA §611(a)(2), "
            "review of all submitted information, deletion/correction of unverifiable items, "
            "and written results with an updated consumer report if changes are made"
        )
    else:
        opening_ask = (
            ", verification under applicable FCRA furnisher duties, "
            "and written confirmation of the outcome"
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
SSN: {_format_ssn_for_letter(consumer)}
Addresses (first is current; any others are prior addresses on file):
{consumer_addrs}

Disputed items:
{items_block}
{intel_block}

CLEAN-PROFILE PRIORITY:
- Lead with (and emphasize deletion of) collections, charge-offs, and closed/paid accounts that still show late history or other negatives. Ground deletion requests in FCRA accuracy/completeness verification — never argue that an account is "not useful to a clean credit profile."
- For those accounts, the primary ask is DELETE the tradeline if unverifiable; correction is only the fallback.
- Do not soft-pedal closed negatives as mere status tweaks.
- Tailor Basis of Dispute language to each account's specific facts (dates, balances, status inconsistencies, possible obsolescence).

FORMAT: match a polished mailed business letter (like a finished Experian dispute PDF):

1) First line: today's date as Month DD, YYYY (e.g. July 24, 2026). Do NOT write "Page X/Y". Pagination is added when printing.
2) Blank line, then consumer full name in ALL CAPS on its own line.
3) Consumer current address on the following lines (street, unit if any, city/state/ZIP). No labels here.
4) Immediately after the address (still in the opening identity block, before the recipient), include BOTH labeled lines:
   Date of Birth: ...
   Social Security Number: ...
   Use the DOB and SSN values provided above. Prefer the full Social Security Number (XXX-XX-XXXX). Only if a full SSN is unavailable and last-4 alone was provided, format as XXX-XX-1234. Never invent a DOB or SSN.
5) Blank line, then recipient name, then recipient address lines.
6) Blank line, then exactly one RE line starting with "Re: " (not "RE:"). Example:
   Re: Formal Dispute of Inaccurate and Unverifiable Credit Report Information, {plan.statute}
7) Blank line, then salutation: "Dear Sir or Madam:"
8) One or two short opening paragraphs stating this is a formal dispute under {plan.statute}, requesting a reasonable reinvestigation{opening_ask}.

9) Section heading on its own line (Title Case, NOT ALL CAPS): Consumer Identification
   Then labeled fields (one per line):
   Full Name: ...
   Date of Birth: ...
   Social Security Number: ...
   Current Address:  (next lines = address, no bullets)
   If more than one consumer address was provided, add:
   Additional Addresses on File:
   ● address one
   ● address two
   (Use a filled circle bullet "●", not dashes.)

10) Section heading: Disputed Tradelines
   Order accounts so closed, paid, collection, and other obsolete negatives come first.
   For EACH disputed account, use this exact block structure (blank line between accounts):

**Creditor Name Exactly As Given**
Account Number: ...
Reported Status: ...
Reported Balance: ...
Basis of Dispute:
<ONE concise paragraph. Use the consumer's dispute reason as the core. Do NOT repeat the same opener (e.g. "I dispute this tradeline as inaccurate and unverifiable") or restack the same FCRA cite. Mention {plan.statute} at most once. For closed/paid/collection accounts, include one clear deletion ask if unverifiable. Wrap the creditor name on the first line in **double asterisks** for bold.>

11) Section heading: Statutory Reinvestigation Requirements
    Short intro sentence, then ● bullet list of the recipient's statutory duties (bureau: 30-day reinvestigation, 5-business-day furnisher notice, review of evidence, delete/modify unverifiable data, written results). Cite {plan.statute} and related FCRA sections accurately.

12) Section heading: Requested Outcome
    Lead with deletion: for each disputed tradeline, especially closed, paid, collection, or otherwise obsolete negatives, delete the account if it cannot be verified as accurate and complete. Only alternatively correct inaccurate fields (status, balance, past-due, payment history, delinquency ratings). Ask that written results be mailed to the address above.

13) Closing paragraph thanking them and expecting FCRA compliance.
14) Closing: "Respectfully," then two blank lines, then the consumer's name in normal title/case (not ALL CAPS). Keep that printed name as plain text only. The formatter places a cursive signature of the same name on the right side of the page next to it — do not draw ASCII art.
15) After the sign-off name, section heading: Enclosures
    Then always include these bullets (the mailing packet attaches the copies/images):
    ● Copy of government-issued photo identification
    ● Proof of current residential address
    ● Screenshots of the disputed account(s) from my consumer credit report
    Do NOT list credit score pages, score dashboards, or summary-only screenshots.

Rules:
- Professional tone suitable for certified mail. No legal-advice disclaimer in the letter body.
- Do NOT use markdown headers (#), numbered lists, or italic *emphasis*. Only **bold** on creditor name lines.
- Use "● " for bullets under Additional Addresses and Statutory Requirements.
- Do NOT invent facts not provided (balances, statuses, addresses, account numbers, DOB, SSN).
- Date of Birth and Social Security Number MUST appear in the opening identity block under the consumer address AND again under Consumer Identification.
- Do NOT guarantee deletion or score improvement.
- Do NOT use em dashes (—), en dashes (–), or a spaced hyphen as punctuation. Use a comma or a period. Keep hyphens only inside words such as charge-off.
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


def _letter_agent_enabled() -> bool:
    """The local FCRA template is the default. The Cursor agent is opt-in and time-boxed."""
    return os.environ.get("DISPUTE_LETTER_AGENT", "").strip().lower() in {"1", "true", "yes", "on"}


def _letter_agent_timeout_sec() -> float:
    raw = os.environ.get("DISPUTE_LETTER_AGENT_TIMEOUT_SEC", "").strip()
    try:
        value = float(raw) if raw else 15.0
    except ValueError:
        value = 15.0
    return min(max(value, 3.0), 30.0)


async def generate_letter_async(plan: LetterPlan, consumer: ConsumerInfo, report=None) -> str:
    notes = _intelligence_notes_for_plan(plan, report) if report is not None else []
    prompt = build_letter_prompt(plan, consumer, intelligence_notes=notes or None)
    api_key = os.environ.get("CURSOR_API_KEY", "").strip()
    if api_key and _letter_agent_enabled():
        try:
            text = await asyncio.wait_for(
                _generate_via_sdk_async(prompt),
                timeout=_letter_agent_timeout_sec(),
            )
            if text.strip():
                return normalize_letter_source(text)
        except Exception:
            pass
    return normalize_letter_source(_template_fallback(plan, consumer))


async def _generate_via_sdk_async(prompt: str) -> str:
    from app.services.cursor_client import agent_prompt, result_text

    result = await agent_prompt(prompt)
    text = result_text(result).strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("markdown").strip()
    return text


def generate_letter(plan: LetterPlan, consumer: ConsumerInfo, report=None) -> str:
    return asyncio.run(generate_letter_async(plan, consumer, report))


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
        basis = compose_basis_of_dispute(
            recipient=recipient,
            statute=plan.statute,
            status=status,
            reason=(it.dispute_reason or "").strip(),
        )
        item_blocks.append(
            f"**{it.creditor}**\n"
            f"Account Number: {it.account_number or 'Not Reported'}\n"
            f"Reported Status: {status}\n"
            f"Reported Balance: {balance}\n"
            f"Basis of Dispute:\n"
            f"{basis}"
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
            f"For each disputed tradeline identified above, especially collections, charge-offs, "
            f"and closed or paid accounts that still show late history or other negative reporting, "
            f"I request that {recipient} delete the account in full if it cannot be verified as "
            f"accurate and complete under FCRA §611. Only if the account is verified should "
            f"inaccurate fields be corrected, including account status, balance, past-due amount, "
            f"payment history, and delinquency ratings.\n\n"
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
            f"For each disputed tradeline identified above, especially closed, paid, collection, "
            f"or other accounts still reporting negative or unverifiable information, I request "
            f"that you delete the account if it cannot be verified as accurate and complete under "
            f"FCRA §623, or alternatively correct all inaccurate fields and update each consumer "
            f"reporting agency accordingly.\n\n"
            f"Please mail written confirmation of your investigation results to the address listed above."
        )

    identity_header = _identity_header_lines(consumer)
    dob = _format_dob_for_letter(consumer)
    ssn = _format_ssn_for_letter(consumer)

    return f"""{today}

{name_caps}
{current_addr}
{identity_header}

{plan.recipient_name}
{addr}

Re: Formal Dispute of Inaccurate and Unverifiable Credit Report Information, {plan.statute}

Dear Sir or Madam:

{opening}

Consumer Identification
Full Name: {consumer.name or "[Your Name]"}
Date of Birth: {dob}
Social Security Number: {ssn}
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

Enclosures
● Copy of government-issued photo identification
● Proof of current residential address
● Screenshots of the disputed account(s) from my consumer credit report
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
