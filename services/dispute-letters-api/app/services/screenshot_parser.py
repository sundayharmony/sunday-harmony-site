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
_CREDITOR_STOP = re.compile(
    r"(?i)^(?:overview|payment history|account details?|creditor information|"
    r"open|closed|current|in ?good standing|ad|we're|you|monthly|amount|balance|credit)\b"
)


def parse_screenshot_accounts(text: str, bureau: BureauCode | None) -> list[Tradeline]:
    lines = [ln.strip() for ln in (text or "").splitlines()]
    lines = [ln for ln in lines if ln]
    anchors: list[tuple[int, str, str]] = []
    for i, line in enumerate(lines):
        if i == 0 or not _ANCHOR.match(line) or not re.search(rf"(?i){_MONTHS}|\d{{4}}", line):
            continue
        creditor, inline_balance = _creditor_line(lines[i - 1])
        if not creditor:
            continue
        anchors.append((i, creditor, inline_balance))

    tradelines: list[Tradeline] = []
    seen: set[str] = set()
    for n, (start, creditor, inline_balance) in enumerate(anchors):
        end = anchors[n + 1][0] - 1 if n + 1 < len(anchors) else len(lines)
        block = "\n".join(lines[start:end])
        fields = {
            "creditor": creditor,
            "last_reported": _date_after(lines[start]),
            "balance": _first(rf"(?i)ba\w*nce\s*:?\s*{_AMOUNT}", block) or inline_balance,
            "credit_limit": _first(rf"(?i)(?:cr\w*\s*)?[il1]\w*m\w*t\w*\s*:?\s*{_AMOUNT}", block),
            "past_due": _first(rf"(?i)past\s*(?:due|ove|cue)\s*{_AMOUNT}", block),
            "monthly_payment": _first(rf"(?i)mo\w+\s+pay\w*\s+amount\s*{_AMOUNT}", block),
            "status": _status(block),
        }
        for k in ("balance", "credit_limit", "past_due", "monthly_payment"):
            if fields[k]:
                fields[k] = "$" + fields[k]
        key = f"{creditor.lower()}|{fields['balance']}|{fields['last_reported']}|{fields['credit_limit']}"
        if key in seen:
            continue
        seen.add(key)
        if not (fields["balance"] or fields["status"]):
            continue
        tradelines.append(
            Tradeline(
                id=str(uuid.uuid4()),
                creditor=creditor,
                status=fields["status"],
                balance=fields["balance"],
                past_due=fields["past_due"],
                credit_limit=fields["credit_limit"],
                last_reported=fields["last_reported"],
                monthly_payment=fields["monthly_payment"],
                bureaus=[bureau] if bureau else [],
                is_collection=bool(re.search(r"(?i)collection|lvnv|portfolio recovery|midland", block[:400] + creditor)),
                analysis_notes="Read from a screenshot. Check the details against the report before sending letters.",
            )
        )
    return tradelines


def _creditor_line(raw: str) -> tuple[str, str]:
    balance = _first(rf"{_AMOUNT}\s*$", raw)
    name = re.sub(rf"\s*{_AMOUNT}\s*$", "", raw).strip(" '‘’\"-—|.:,()")
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
        days = re.search(r"\d+", raw)
        return f"Late {days.group(0)} Days" if days else "Late"
    for word in ("Charge off", "Collection", "Current", "Paid", "Closed"):
        if word.lower() in raw.lower():
            return word
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
