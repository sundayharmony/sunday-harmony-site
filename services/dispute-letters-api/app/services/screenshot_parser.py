"""Accounts from OCR of bureau-website screenshots ("FullPage Capture" PDFs).

These PDFs are pictures of experian.com / equifax.com / transunion.com account
cards. OCR text is noisy, so this reads only the steady anchors on each card:

    KIKOFF LENDING LLC $123.45        <- creditor (balance sometimes on the same line)
    Reported: Oct 12, 2026            <- anchor (OCR may garble it: "Report Ost", "Reporte:")
    Balance: $123.45 Credit limit: $750.00
    Current Payment Status Late 30 Days
    Amount Past Due $45.00
"""
from __future__ import annotations

import re
import uuid

from app.models import BureauCode, Tradeline

_ANCHOR = re.compile(r"(?i)^\W{0,3}re?port\w{0,4}\b[:;.,]?\s*\S")
_MONTHS = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|o[sa]t|nov|dec)"
_AMOUNT = r"\$?\s*([\d][\d,]*\.\d{2})"
_AMOUNT_ONLY_TAIL = re.compile(r"\$\s*[\d][\d,]*\.\d{2}\W*$")
_BLOCK_END = re.compile(r"(?i)^(?:hide \d+|show all|hard inquiries|public records|creditors)\b")
_CREDITOR_STOP = re.compile(
    r"(?i)^(?:overview|payment history|account details?|creditor information|"
    r"open|closed|current|in ?good standing|ad|we're|you|monthly|amount|balance|credit)\b"
)


# Section headings on bureau/monitoring sites, and the account type each implies.
_SECTIONS = {
    "credit cards": "Credit Card (Revolving)",
    "revolving accounts": "Credit Card (Revolving)",
    "auto loans": "Auto Loan (Installment)",
    "student loans": "Student Loan (Installment)",
    "installment accounts": "Installment",
    "installment loans": "Installment",
    "personal loans": "Personal Loan (Installment)",
    "real estate": "Mortgage",
    "mortgages": "Mortgage",
    "collections": "Collection",
    "other": "Other Account",
    "other accounts": "Other Account",
    "hard inquiries": "",
}


def _section_types(lines: list[str]) -> list[str]:
    """Account type implied by the section heading each line sits under."""
    current = ""
    out = []
    for line in lines:
        key = re.sub(r"[^a-z ]", "", line.lower()).strip()
        if key in _SECTIONS:
            current = _SECTIONS[key]
        out.append(current)
    return out


def parse_screenshot_accounts(text: str, bureau: BureauCode | None) -> list[Tradeline]:
    lines = [ln.strip() for ln in (text or "").splitlines()]
    lines = [ln for ln in lines if ln]
    sections = _section_types(lines)
    anchors: list[tuple[int, str, str]] = []
    for i, line in enumerate(lines):
        if i == 0 or not _ANCHOR.match(line) or not re.search(rf"(?i){_MONTHS}|\d{{4}}", line):
            continue
        creditor, inline_balance = _creditor_line(lines[i - 1])
        if not creditor:
            # Collection cards print no collector name; the original creditor stands in.
            creditor = _original_creditor(lines, i)
            inline_balance = _first(rf"{_AMOUNT}\s*$", lines[i - 1])
        if not creditor:
            continue
        anchors.append((i, creditor, inline_balance))
    # Every card has one "Account details" heading. A card whose "Reported:" line OCR garbled
    # (or whose name line was lost) has no anchor above; add it from the heading instead.
    previous = -1
    for d, line in enumerate(lines):
        if not re.search(r"(?i)\baccount\s+details\b", line):
            continue
        covered = any(previous < a[0] <= d for a in anchors)
        previous = d
        if covered:
            continue
        start = next((k for k in range(d - 1, max(d - 6, 0), -1) if _AMOUNT_ONLY_TAIL.search(lines[k])), d - 1)
        creditor, inline_balance = _creditor_line(lines[start])
        creditor = creditor or _creditor_info(lines, d) or _original_creditor(lines, d)
        if creditor:
            anchors.append((start, creditor, inline_balance or _first(rf"{_AMOUNT}\s*$", lines[start])))
    anchors.sort()

    tradelines: list[Tradeline] = []
    seen: set[str] = set()
    for n, (start, creditor, inline_balance) in enumerate(anchors):
        end = anchors[n + 1][0] - 1 if n + 1 < len(anchors) else len(lines)
        # Drop a following section heading ("Collections") that sits before the next card.
        card = lines[start:end]
        stop = next((k for k, ln in enumerate(card) if _BLOCK_END.match(ln)), len(card))
        block = "\n".join(ln for ln in card[:stop] if re.sub(r"[^a-z ]", "", ln.lower()).strip() not in _SECTIONS)
        fields = {
            "creditor": creditor,
            "last_reported": _date_after(lines[start]),
            "balance": _first(rf"(?i)ba\w*nce\s*:?\s*{_AMOUNT}", block) or inline_balance,
            "credit_limit": _first(rf"(?i)(?:cr\w*\s*)?[il1]\w*m\w*t\w*\s*:?\s*{_AMOUNT}", block),
            "past_due": _first(rf"(?i)past\s*(?:due|ove|cue)[\s'‘’]*{_AMOUNT}", block),
            "monthly_payment": _first(rf"(?i)mo\w+\s+pay\w*\s+amount\s*{_AMOUNT}", block),
            "status": _status(block),
            "date_opened": _date_after(_first(r"(?i)(?:open\s+date|date\s+opened)\s+(.+)", block)),
            "high_credit": _first(rf"(?i)high(?:est)?\s+ba\w*nce\s*:?\s*{_AMOUNT}", block),
        }
        for k in ("balance", "credit_limit", "past_due", "monthly_payment", "high_credit"):
            if fields[k]:
                fields[k] = "$" + fields[k]
        head = " ".join(lines[start : start + 3])
        collection_card = bool(re.search(r"(?i)collection\s+agency|current\s+rating\s+\W*collection", block))
        if not fields["status"]:
            fields["status"] = (
                "Collection" if collection_card
                else "Current" if re.search(r"(?i)good\s+standing", head)
                else "Past due" if re.search(r"(?i)past\s+due", head)
                else ""
            )
        key = f"{creditor.lower()}|{fields['balance']}|{fields['last_reported']}|{fields['credit_limit']}|{fields['date_opened']}"
        if key in seen:
            continue
        seen.add(key)
        if not (fields["balance"] or fields["status"]):
            continue
        tradelines.append(
            Tradeline(
                id=str(uuid.uuid4()),
                creditor=creditor,
                account_type="Collection" if collection_card else (_card_type(block) or sections[start] if sections[start] in ("", "Other Account") else sections[start]),
                status=fields["status"],
                remarks="Closed account" if _is_closed(lines[start : start + 3], block) else "",
                date_opened=fields["date_opened"],
                high_credit=fields["high_credit"],
                balance=fields["balance"],
                past_due=fields["past_due"],
                credit_limit=fields["credit_limit"],
                last_reported=fields["last_reported"],
                monthly_payment=fields["monthly_payment"],
                bureaus=[bureau] if bureau else [],
                is_collection=collection_card or sections[start] == "Collection"
                or bool(re.search(r"(?i)collection|lvnv|portfolio recovery|midland", block[:400] + creditor)),
                analysis_notes="Read from a screenshot. Check the details against the report before sending letters.",
            )
        )
    return tradelines


def _creditor_line(raw: str) -> tuple[str, str]:
    # A stray letter can trail the amount ("$0.00 A": the card's chevron icon read as text).
    balance = _first(rf"{_AMOUNT}\W*[A-Za-z]?\W*$", raw)
    name = re.sub(rf"\s*{_AMOUNT}\W*[A-Za-z]?\W*$", "", raw).strip(" '‘’\"-—|.:,()")
    letters = re.sub(r"[^A-Za-z]", "", name)
    if len(letters) < 3 or len(name) > 45 or _CREDITOR_STOP.match(name):
        return "", ""
    # Furnisher names print in capitals on these cards; OCR noise is mixed case.
    if sum(c.isupper() for c in letters) / len(letters) < 0.8:
        return "", ""
    return name, balance


def _status(block: str) -> str:
    raw = _first(r"(?i)\b(?:cu?r\w{0,6}|caren|cent)\s+pa\w{3,6}\s+s\w{3,6}\s+(.+)", block)
    if re.search(r"(?i)late\s*\d+", raw):
        days = int(re.search(r"\d+", raw).group(0))
        # Cards only print 30/60/90/120/150/180; OCR reads "30" as "20" or "80" as "60", so snap.
        days = min((30, 60, 90, 120, 150, 180), key=lambda v: abs(v - days))
        return f"Late {days} Days"
    for word in ("Charge off", "Collection", "Current", "Paid", "Closed"):
        if word.lower() in raw.lower():
            return word
    if re.search(r"(?i)\bas\s+ag\w+", raw):
        return "Current"
    return ""


_TYPE_WORDS = (
    r"(?:credit|charge|check|note|installment|secured|unsecured|automobile|auto|mortgage|rental|line|"
    r"student|personal|home|lease|education|conventional|business)"
)


def _card_type(block: str) -> str:
    """The card's own "Type" row, for sections ("Other") that name no account type."""
    raw = _first(rf"(?im)(?<![A-Za-z])type\s+\W*({_TYPE_WORDS}[A-Za-z ]{{0,40}})\s*$", block)
    lowered = raw.lower()
    if not raw:
        return ""
    if "credit card" in lowered or "charge" in lowered or "line" in lowered or "check credit" in lowered:
        kind = "Revolving"
    elif "rental" in lowered or "lease" in lowered:
        kind = "Other"
    else:
        kind = "Installment"
    return f"{raw.strip().title()} ({kind})"


def _is_closed(head: list[str], block: str) -> bool:
    return bool(re.search(r"(?i)\bclosed\b", " ".join(head[:2]))) or bool(
        re.search(r"(?i)account\s+status\s+\W*closed", block)
    )


def _original_creditor(lines: list[str], at: int) -> str:
    """Collection cards: "Original Creditor XFINITY MOBILE"."""
    for line in lines[at : at + 14]:
        match = re.match(r"(?i)^\W*original\s+creditor\s+(.+)$", line)
        if match:
            return match.group(1).strip(" '‘’\"-—|.:,()")
        if _ANCHOR.match(line) and line is not lines[at]:
            break
    return ""


def _creditor_info(lines: list[str], at: int) -> str:
    """The furnisher name printed under "Creditor information" (used when the card title was lost)."""
    for k in range(at, min(at + 40, len(lines) - 1)):
        if re.match(r"(?i)^\W*creditor information\b", lines[k]):
            name, _ = _creditor_line(lines[k + 1])
            return name
    return ""


def _date_after(line: str) -> str:
    match = re.search(rf"(?i)({_MONTHS})\w*\.?\s*(\d{{1,2}})\s*,?\s*(\d{{4}})", line)
    if not match:
        return ""
    month = match.group(1).title().replace("Ost", "Oct").replace("Oat", "Oct")
    return f"{month} {match.group(2)}, {match.group(3)}"


def _first(pattern: str, text: str) -> str:
    match = re.search(pattern, text or "")
    return match.group(1).strip() if match else ""
