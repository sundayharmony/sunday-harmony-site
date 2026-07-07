from __future__ import annotations

import os
import re
from pathlib import Path

from app.config import LETTERS_DIR
from app.models import ConsumerInfo, LetterPlan
from app.services.letter_formatter import finalize_letter, normalize_letter_source


def build_letter_prompt(plan: LetterPlan, consumer: ConsumerInfo) -> str:
    items_block = "\n".join(
        f"- Creditor: {it.creditor}; Account: {it.account_number}; Bureau: {it.bureau}; "
        f"Status: {it.status}; Balance: {it.balance}; Reason: {it.dispute_reason}"
        for it in plan.items
    )
    addr = "\n".join(plan.recipient_lines)
    consumer_addrs = "\n".join(consumer.addresses) if consumer.addresses else "[Consumer address]"
    letter_kind = "credit bureau" if plan.letter_type.startswith("bureau_") else "data furnisher"

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
Address: {consumer_addrs}

Disputed items:
{items_block}

Requirements:
- Cite {plan.statute} and demand compliance with statutory deadlines (30-day reinvestigation for bureaus).
- Professional business letter tone suitable for printing and mailing.
- Format like a formal business letter: date, your address, recipient address, RE line, salutation, body, closing, signature.
- Section labels (e.g. DISPUTED ITEMS) on their own line in ALL CAPS.
- For EACH disputed account use this exact structure:

**Creditor Name** — Account #1234567890
    Reported status: ...
    Balance: ...
    Dispute reason: ...

  (Creditor name wrapped in **double asterisks** for bold. Detail lines indented with exactly 4 spaces.)
- Do NOT use bullets, hash headers, or italic asterisks. Only ** for creditor names.
- Output ONLY the letter body (no code fences).
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
    consumer_addr = consumer.addresses[0] if consumer.addresses else "[Your Address]"
    items = "\n\n".join(
        f"**{it.creditor}** — Account #{it.account_number}\n"
        f"    Reported status: {it.status}\n"
        f"    Balance: {it.balance}\n"
        f"    Dispute reason: {it.dispute_reason}"
        for it in plan.items
    )
    return f"""{today}

{consumer.name or "[Your Name]"}
{consumer_addr}

{plan.recipient_name}
{addr}

RE: Formal Dispute Under {plan.statute}

To Whom It May Concern:

I am writing to dispute inaccurate or unverifiable information in my consumer file pursuant to {plan.statute}.

CONSUMER INFORMATION
Name: {consumer.name}
Date of Birth: {consumer.dob}
Address: {consumer_addr}

DISPUTED ITEMS

{items}

I request that you conduct a reasonable reinvestigation within 30 days, correct or delete any information that cannot be verified, and provide written results as required by the Fair Credit Reporting Act.

Sincerely,


{consumer.name or "[Consumer Name]"}
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
