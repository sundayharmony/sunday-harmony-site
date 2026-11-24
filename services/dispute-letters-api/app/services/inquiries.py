"""Hard inquiries for layouts whose account parsers skip them.

Covers:
- experian.com PDFs: a grid of cards, three per row ("NAME" over "Inquired on Oct 3, 2026").
- myEquifax / TransUnion-style PDFs: "Hard inquiries" then NAME / date / business type.
- SmartCredit: "Creditor Name  Date of Inquiry  Credit Bureau" table.
IdentityIQ inquiries are read by its own parser.
"""
from __future__ import annotations

import re
import uuid

from app.models import BureauCode, ExtractedDocument, Tradeline

_DATE = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, \d{4}"
_LOOSE_DATE = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, ?\d{4}"


# Field labels from account cards; never an inquiring company's name.
_LABEL = re.compile(r"(?i)^\W*(date opened|last activity|account number|date reported|reported|balance|status)\b")


def _tidy_date(value: str) -> str:
    return re.sub(r",\s*", ", ", value)


_SECTION_END = re.compile(
    r"^(?:Collections|Public records|Personal information|Accounts|Credit accounts|"
    r"Creditor Contacts|Soft inquiries|Account history)\s*$",
    re.I,
)
_BUREAU_WORDS = {"transunion": "TUC", "experian": "EXP", "equifax": "EQF"}


def add_inquiries(report, doc: ExtractedDocument, bureau: BureauCode | None) -> None:
    """Append inquiry rows when the parser found none. Never raises."""
    if any("inquir" in (t.account_type or "").lower() for t in report.tradelines):
        return
    try:
        rows = _smartcredit_table(doc.text or "")
        if not rows and bureau:
            grid = _experian_grid(_layout(doc), bureau) if "Inquired on" in (doc.text or "") else []
            rows = grid or _named_list(doc.text or "", bureau)
    except Exception:
        rows = []
    report.tradelines.extend(rows)


def _row(name: str, date: str, bureau: BureauCode, business: str = "") -> Tradeline:
    return Tradeline(
        id=str(uuid.uuid4()),
        creditor=name.strip(),
        account_type="Hard Inquiry",
        remarks=business.strip(),
        date_opened=date,
        last_reported=date,
        bureaus=[bureau],
        dispute_bureaus=[bureau],
    )


def _layout(doc: ExtractedDocument) -> str:
    if doc.file_type == "pdf" and doc.raw_path:
        try:
            import pdfplumber

            with pdfplumber.open(doc.raw_path) as pdf:
                return "\n".join((p.extract_text(layout=True) or "") for p in pdf.pages)
        except Exception:
            pass
    return doc.text or ""


def _experian_grid(text: str, bureau: BureauCode) -> list[Tradeline]:
    lines = text.splitlines()
    out: list[Tradeline] = []
    for i, line in enumerate(lines):
        dates = list(re.finditer(rf"Inquired on\s+({_DATE})", line))
        if not dates or i == 0:
            continue
        names_line = next((lines[k] for k in range(i - 1, max(-1, i - 3), -1) if lines[k].strip()), "")
        names = [n for n in re.split(r"\s{2,}", names_line.strip()) if n]
        if len(names) != len(dates):
            starts = [m.start() for m in dates] + [len(names_line)]
            names = [names_line[starts[k] : starts[k + 1]].strip() for k in range(len(dates))]
        for name, match in zip(names, dates):
            if name:
                out.append(_row(name, match.group(1), bureau))
    return out


def _named_list(text: str, bureau: BureauCode) -> list[Tradeline]:
    lines = [ln.strip() for ln in text.splitlines()]
    start = next(
        (k for k, ln in enumerate(lines) if re.fullmatch(r"(?i)hard inquiries", ln) or re.search(r"(?i)latest hard inquiries on your", ln)),
        None,
    )
    if start is None:
        return []
    out: list[Tradeline] = []
    k = start + 1
    while k + 1 < len(lines):
        if _SECTION_END.match(lines[k]) or re.match(r"(?i)show all inquiries", lines[k]):
            break
        # Monitoring-site cards: "<name> <date>" then "Creditor information" / "<NAME>".
        # The name under "Creditor information" is the clean one; OCR often garbles the first.
        dated = re.search(_LOOSE_DATE, lines[k])
        info_re = r"(?i)\W*creditor information\W*"
        info = next((j for j in range(k + 1, min(k + 4, len(lines))) if re.fullmatch(info_re, lines[j])), None)
        name_at = None
        if dated and info is not None:
            name_at = next(
                (j for j in range(info + 1, min(info + 5, len(lines))) if lines[j] and not re.fullmatch(info_re, lines[j])),
                None,
            )
        if name_at is not None and not _LABEL.match(lines[name_at]) and not re.search(_LOOSE_DATE, lines[name_at]):
            out.append(_row(lines[name_at].strip(" '‘’-"), _tidy_date(dated.group(0)), bureau))
            k = name_at + 1
            continue
        # OCR drops the space after the comma and adds stray marks after the date.
        same_line = re.fullmatch(rf"(.{{2,40}}?)\s+({_LOOSE_DATE})\W{{0,3}}\w?\W{{0,2}}", lines[k])
        if same_line and not re.search(r"(?i)inquir", lines[k]) and not _LABEL.match(same_line.group(1)):
            out.append(_row(same_line.group(1).strip(" '‘’-"), _tidy_date(same_line.group(2)), bureau))
            k += 1
            continue
        if re.fullmatch(_DATE, lines[k + 1]) and lines[k] and len(lines[k]) <= 40:
            business = lines[k + 2] if k + 2 < len(lines) and not re.fullmatch(_DATE, lines[k + 2]) else ""
            out.append(_row(lines[k], lines[k + 1], bureau, business))
            k += 3 if business else 2
            continue
        k += 1
    return out


def _smartcredit_table(text: str) -> list[Tradeline]:
    lines = text.splitlines()
    start = next((k for k, ln in enumerate(lines) if re.match(r"\s*Creditor Name\s+Date of Inquiry\s+Credit Bureau", ln)), None)
    if start is None:
        return []
    out: list[Tradeline] = []
    for line in lines[start + 1 :]:
        match = re.match(r"\s*(\S.*?)\s+(\d{1,2}/\d{1,2}/\d{4})\s+(TransUnion|Experian|Equifax)\s*$", line)
        if not match:
            if line.strip() and not out:
                continue
            break
        out.append(_row(match.group(1), match.group(2), _BUREAU_WORDS[match.group(3).lower()]))  # type: ignore[arg-type]
    return out
