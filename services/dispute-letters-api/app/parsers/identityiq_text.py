"""IdentityIQ / MyScoreIQ "Three Bureau Credit Report" saved as PDF.

The PDF keeps the web page's three columns (TransUnion | Experian | Equifax), so it
is read with layout-preserving text and each value is assigned to the bureau column
it sits under:

    DISCOVERCARD
                         TransUnion          Experian          Equifax
         Account #:      12345678****        12345678****      12345678****
    Payment Status:      Current             Late 30 Days      Current
"""
from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.models import BureauCode, ConsumerInfo, ExtractedDocument, ParsedReport, Tradeline

BUREAUS: tuple[BureauCode, ...] = ("TUC", "EXP", "EQF")
_HEADER = re.compile(r"TransUnion\s{2,}Experian\s{2,}Equifax")
_LABEL = re.compile(r"^\s*([A-Za-z][A-Za-z0-9 .#()/&'-]{1,40}):(.*)$")
_STOP = re.compile(r"^\s*(Account History|Inquiries|Public Information|Creditor Contacts)\b", re.I)
_FIELD_MAP = {
    "account #": "account",
    "account type": "account_type",
    "account type - detail": "account_detail",
    "bureau code": "bureau_code",
    "account status": "open_closed",
    "monthly payment": "monthly_payment",
    "date opened": "date_opened",
    "balance": "balance",
    "high credit": "high_credit",
    "credit limit": "credit_limit",
    "past due": "past_due",
    "payment status": "status",
    "last reported": "last_reported",
    "comments": "remarks",
}
_HISTORY_ROW = re.compile(r"^\s*(TransUnion|Experian|Equifax)\s+((?:(?:OK|ND|CO|\d{2,3}|-)\s*)+)$")
_LATE_CODE = re.compile(r"^(30|60|90|120|150|180|CO)$")
_STATUS_RANK = ("collection", "charge", "late 1", "late 9", "late 6", "late 3", "late", "derog")


def can_parse_text(text: str) -> bool:
    head = (text or "")[:6000]
    return bool(
        re.search(r"Three Bureau Credit Report", head, re.I)
        and re.search(r"TransUnion\s+Experian\s+Equifax", text or "")
        and re.search(r"Account History", text or "", re.I)
    )


def _page_lines(page) -> list[str]:
    """Text lines keeping true horizontal positions: words in one phrase are one space apart and
    columns sit a gap apart, however long the values are (pdfplumber's own layout mode squeezes
    long values against the next column, which merges the bureaus' cells)."""
    words = sorted(page.extract_words(), key=lambda w: (w["top"], w["x0"]))
    rows: list[list[dict]] = []
    for w in words:
        if rows and abs(w["top"] - rows[-1][0]["top"]) < 3:
            rows[-1].append(w)
        else:
            rows.append([w])
    lines = []
    for row in rows:
        out, edge = "", 0.0
        for w in sorted(row, key=lambda w: w["x0"]):
            gap = w["x0"] - edge
            if not out:
                out = " " * int(w["x0"] / 4.5)
            else:
                out += " " * (1 if gap < 4 else max(2, round(gap / 4.5)))
            out += w["text"]
            edge = w["x1"]
        lines.append(out)
    return lines


def layout_text(doc: ExtractedDocument) -> str:
    """Column-preserving text for PDFs; plain text otherwise."""
    if doc.file_type == "pdf" and doc.raw_path and Path(doc.raw_path).exists():
        try:
            import pdfplumber

            with pdfplumber.open(doc.raw_path) as pdf:
                return "\n".join("\n".join(_page_lines(p)) for p in pdf.pages)
        except Exception:
            pass
    return doc.text or ""


def parse(doc: ExtractedDocument) -> ParsedReport:
    text = layout_text(doc)
    lines = text.splitlines()
    tradelines: list[Tradeline] = []
    in_accounts = False
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^\s*Account History\b", line):
            in_accounts = True
        elif re.match(r"^\s*(Inquiries|Public Information|Creditor Contacts)\b", line):
            in_accounts = False
        if in_accounts:
            header_at = _next_header(lines, i + 1)
            name = line.strip()
            if header_at is not None and _looks_like_creditor(line):
                tl, i = _read_account(name, lines, header_at)
                if tl:
                    tradelines.append(tl)
                continue
        i += 1
    tradelines.extend(_inquiries(lines))
    report = ParsedReport(
        source="fallback_parser",
        reference=_first(r"Reference #:\s*(\S+)", text),
        report_date=_first(r"Report Date:\s*([\d/]+)", text),
        consumer=_consumer(lines),
        tradelines=tradelines,
        file_type=doc.file_type,
        ocr_used=doc.ocr_used,
        extraction_quality=doc.extraction_quality,
    )
    for key, value in zip(("tuc", "exp", "eqf"), _scores(lines)):
        if value:
            setattr(report.credit_health.scores, key, value)
    return report


def _scores(lines: list[str]) -> list[int | None]:
    """The "Credit Score:" row under the first TransUnion | Experian | Equifax header."""
    centers: list[float] | None = None
    for line in lines:
        if _HEADER.search(line):
            centers = _columns(line)
        match = _LABEL.match(line)
        if centers and match and match.group(1).strip().lower() == "credit score":
            cells = _split_values(match.group(2), match.start(2), centers)
            return [int(c) if c.isdigit() and 300 <= int(c) <= 850 else None for c in cells]
    return [None, None, None]


def _looks_like_creditor(line: str) -> bool:
    name = line.strip()
    indent = len(line) - len(line.lstrip())
    if not name or indent > 10 or len(name) > 60 or ":" in name:
        return False
    return not re.search(r"(?i)back to top|printed using|explore our|^legend$", name)


def _next_header(lines: list[str], start: int) -> int | None:
    for j in range(start, min(start + 6, len(lines))):
        if _HEADER.search(lines[j]):
            return j
        if lines[j].strip():
            return None
    return None


def _columns(header: str) -> list[float]:
    centers = []
    for word in ("TransUnion", "Experian", "Equifax"):
        at = header.find(word)
        centers.append(at + len(word) / 2)
    return centers


def _split_values(rest: str, offset: int, centers: list[float]) -> list[str]:
    cells = ["", "", ""]
    for match in re.finditer(r"\S+(?: \S+)*", rest):
        if match.group(0) in {"-", "--"}:
            continue
        mid = offset + match.start() + (match.end() - match.start()) / 2
        col = min(range(3), key=lambda k: abs(centers[k] - mid))
        cells[col] = (cells[col] + " " + match.group(0)).strip()
    return [("" if c in {"-", "--"} else c) for c in cells]


def _read_account(name: str, lines: list[str], header_at: int) -> tuple[Tradeline | None, int]:
    centers = _columns(lines[header_at])
    fields: dict[str, list[str]] = {}
    late: dict[str, set[str]] = {}
    j = header_at + 1
    while j < len(lines):
        line = lines[j]
        if _STOP.match(line) or (_looks_like_creditor(line) and _next_header(lines, j + 1) is not None):
            break
        if _HEADER.search(line):
            centers = _columns(line)  # columns can shift after a page break
        grid = _HISTORY_ROW.match(line)
        if grid:
            for code in grid.group(2).split():
                if _LATE_CODE.match(code):
                    late.setdefault(code, set()).add(grid.group(1))
        match = _LABEL.match(line)
        if match:
            key = _FIELD_MAP.get(match.group(1).strip().lower())
            if key and key not in fields:
                fields[key] = _split_values(match.group(2), match.start(2), centers)
        j += 1
    accounts = fields.get("account", ["", "", ""])
    present = [b for b, acct, bal in zip(BUREAUS, accounts, fields.get("balance", ["", "", ""])) if acct or bal]
    if not present:
        return None, j

    def pick(key: str) -> str:
        values = fields.get(key, ["", "", ""])
        return next((v for v in values if v), "")

    statuses = [s for s in fields.get("status", []) if s]
    status = max(statuses, key=_status_weight) if statuses else ""
    open_closed = pick("open_closed")
    account_type = pick("account_detail") or pick("account_type")
    remarks = "; ".join(dict.fromkeys(v for v in fields.get("remarks", []) if v))
    history = ""
    if late:
        history = "Late in payment history: " + ", ".join(
            f"{'charge-off' if c == 'CO' else c + ' days'} ({'/'.join(sorted(late[c]))})"
            for c in sorted(late, key=lambda c: (c == "CO", int(c) if c.isdigit() else 0))
        )
    blob = f"{name} {account_type} {status} {remarks}".lower()
    return (
        Tradeline(
            id=str(uuid.uuid4()),
            creditor=name,
            account_tu=accounts[0],
            account_exp=accounts[1],
            account_eqf=accounts[2],
            account_type=account_type,
            status=f"{open_closed}. {status}".strip(". ") if open_closed and status else (status or open_closed),
            balance=pick("balance"),
            past_due=pick("past_due"),
            remarks=remarks,
            payment_history=history,
            credit_limit=pick("credit_limit"),
            high_credit=pick("high_credit"),
            date_opened=pick("date_opened"),
            last_reported=pick("last_reported"),
            monthly_payment=pick("monthly_payment"),
            bureaus=present,
            dispute_bureaus=list(present),
            is_collection="collection" in blob,
        ),
        j,
    )


def _status_weight(status: str) -> int:
    lowered = status.lower()
    for rank, word in enumerate(_STATUS_RANK):
        if word in lowered:
            return len(_STATUS_RANK) - rank
    return 0


_BUREAU_NAMES = {"transunion": "TUC", "experian": "EXP", "equifax": "EQF"}


def _inquiries(lines: list[str]) -> list[Tradeline]:
    out: list[Tradeline] = []
    start = next((k for k, ln in enumerate(lines) if re.match(r"^\s*Creditor Name\s{2,}Type of Business", ln)), None)
    if start is None:
        return out
    for line in lines[start + 1 :]:
        if re.match(r"^\s*(Public Information|Creditor Contacts)\b", line):
            break
        match = re.match(r"^\s*(\S.*?)\s{2,}(.*?)\s{2,}(\d{1,2}/\d{1,2}/\d{4})\s+(TransUnion|Experian|Equifax)\s*$", line)
        if not match:
            continue
        bureau: BureauCode = _BUREAU_NAMES[match.group(4).lower()]  # type: ignore[assignment]
        out.append(
            Tradeline(
                id=str(uuid.uuid4()),
                creditor=match.group(1).strip(),
                account_type="Hard Inquiry",
                remarks=match.group(2).strip(),
                date_opened=match.group(3),
                last_reported=match.group(3),
                bureaus=[bureau],
                dispute_bureaus=[bureau],
            )
        )
    return out


def _consumer(lines: list[str]) -> ConsumerInfo:
    for k, line in enumerate(lines):
        match = re.match(r"^\s*Name:\s+(.*)$", line)
        if match:
            name = re.split(r"\s{2,}", match.group(1).strip())[0]
            return ConsumerInfo(name=name)
        if k > 200:
            break
    return ConsumerInfo()


def _first(pattern: str, text: str) -> str:
    match = re.search(pattern, text or "")
    return match.group(1).strip() if match else ""
