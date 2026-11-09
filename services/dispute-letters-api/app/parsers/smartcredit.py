"""SmartCredit / ConsumerDirect 3-bureau PDF (and HTML stub) parser.

SmartCredit print-to-PDF exports use a fixed 3-column TransUnion / Experian / Equifax
layout with the furnisher name on the line above the bureau header. The previous
stub only detected HTML and left PDF text to the Credit Hero / labeled fallbacks,
which produced junk creditors like "Payment Amount:" and identical scores.
"""

from __future__ import annotations

import re
import uuid

from app.models import BureauCode, BureauScores, ConsumerInfo, CreditHealthSummary, ParsedReport, Tradeline
from app.services.bureau_scores import parse_score_value

_EMPTY = re.compile(r"^(?:--|—|-|n/?a|none|none reported)?$", re.I)
_SECTION_HEADER = re.compile(
    r"(?i)^(?:"
    r".*\baccounts?\s*:|"
    r"account history|at-a-glance|two-year payment history|days late|"
    r"public (?:records|information)|inquir(?:y|ies)|summary|personal information|"
    r"consumer statement|unknown|none reported|collections?|"
    r"real estate|revolving|installment|open accounts|closed accounts"
    r").*$"
)
_CREDITOR_LINE = re.compile(r"^[A-Z0-9][A-Z0-9 /&.,'\-]{1,70}$")
_FIELD_MAP = {
    "account #": "account",
    "account number": "account",
    "high balance": "high_credit",
    "highest balance": "high_credit",
    "balance owed": "balance",
    "current balance": "balance",
    "past due amount": "past_due",
    "date opened": "date_opened",
    "date reported": "last_reported",
    "last verified": "last_reported",
    "account type": "account_type",
    "account status": "account_status",
    "payment status": "payment_status",
    "payment amount": "monthly_payment",
    "credit limit": "credit_limit",
    "creditor remarks": "remarks",
    "comments": "remarks",
}
_SCORE_TRIPLET = re.compile(
    r"trans\s*union[^\n]{0,40}experian[^\n]{0,40}equifax"
    r"[\s\S]{0,120}?"
    r"\b(\d{3})\b[^\d]{0,40}\b(\d{3})\b[^\d]{0,40}\b(\d{3})\b",
    re.I,
)
_NAME_ROW = re.compile(
    r"(?im)^\s*name\s+(.+)$"
)
_REPORT_DATE_ROW = re.compile(
    r"(?im)^\s*credit report date\s+(.+)$"
)


def can_parse(html: str) -> bool:
    lower = html.lower()
    return "smartcredit" in lower or "consumerdirect" in lower


def can_parse_text(text: str, file_name: str = "") -> bool:
    blob = f"{file_name}\n{text[:8000]}".lower()
    if "smartcredit" in blob or "consumerdirect" in blob:
        return True
    if "your 3b report" in blob and "vantage" in blob:
        return True
    if (
        "account history" in blob
        and "at-a-glance" in blob
        and "payment status:" in blob
        and "transunion" in blob
        and "experian" in blob
        and "equifax" in blob
    ):
        return True
    return False


def parse(html: str, file_type: str = "html", ocr_used: bool = False, quality: str = "medium") -> ParsedReport:
    """HTML SmartCredit is uncommon in this product; parse text extracted from HTML."""
    return parse_text(html, file_type=file_type, ocr_used=ocr_used, quality=quality)


def parse_text(
    text: str,
    *,
    file_type: str = "pdf",
    ocr_used: bool = False,
    quality: str = "high",
    file_name: str = "",
) -> ParsedReport:
    scores = parse_scores(text)
    consumer = parse_consumer(text)
    report_date = parse_report_date(text)
    tradelines = parse_tradelines(text)
    return ParsedReport(
        source="smartcredit",
        report_date=report_date,
        consumer=consumer,
        tradelines=tradelines,
        file_type=file_type,
        ocr_used=ocr_used,
        extraction_quality=quality if tradelines else "low",
        credit_health=CreditHealthSummary(scores=scores),
    )


def parse_scores(text: str) -> BureauScores:
    scores = BureauScores()
    match = _SCORE_TRIPLET.search(text[:4000])
    if not match:
        return scores
    tuc, exp, eqf = (parse_score_value(match.group(i)) for i in (1, 2, 3))
    scores.tuc = tuc
    scores.exp = exp
    scores.eqf = eqf
    return scores


def parse_report_date(text: str) -> str:
    match = _REPORT_DATE_ROW.search(text)
    if not match:
        return ""
    cols = _split_three(_strip_label_value(match.group(1)))
    for value in cols:
        if value:
            return value
    return ""


def parse_consumer(text: str) -> ConsumerInfo:
    consumer = ConsumerInfo()
    match = _NAME_ROW.search(text)
    if match:
        names = [n for n in _split_three_names(_strip_label_value(match.group(1))) if n]
        if names:
            # Prefer the longest bureau spelling (often includes middle initial).
            consumer.name = max(names, key=len)
    addr_match = re.search(r"(?im)^\s*current address\s+(.+)$", text)
    if addr_match:
        line1 = _split_three(_strip_label_value(addr_match.group(1)))
        # City/state usually on the next non-empty line.
        after = text[addr_match.end() :]
        next_line = ""
        for raw in after.splitlines():
            if raw.strip():
                next_line = raw.strip()
                break
        line2 = (
            _split_three(next_line)
            if next_line and not re.match(r"(?i)^[A-Za-z ]+:", next_line)
            else ["", "", ""]
        )
        addresses: list[str] = []
        for street, city in zip(line1, line2):
            combined = ", ".join(part for part in (street, city) if part)
            if combined and combined not in addresses:
                addresses.append(combined)
        consumer.addresses = addresses
    return consumer


def parse_tradelines(text: str) -> list[Tradeline]:
    lines = text.splitlines()
    tradelines: list[Tradeline] = []
    i = 0
    while i < len(lines):
        name = lines[i].strip()
        if not _looks_like_creditor(name):
            i += 1
            continue
        # Next non-empty line should be the TransUnion / Experian / Equifax header.
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j >= len(lines):
            break
        header = lines[j].strip().lower()
        if "transunion" not in header or "experian" not in header:
            i += 1
            continue
        # Account # row should follow shortly.
        k = j + 1
        while k < len(lines) and not lines[k].strip():
            k += 1
        if k >= len(lines) or not re.match(r"(?i)^account\s*#", lines[k].strip()):
            i += 1
            continue
        block_end = _find_block_end(lines, k)
        block = "\n".join(lines[k:block_end])
        tradeline = _tradeline_from_block(name, block)
        if tradeline is not None:
            tradelines.append(tradeline)
        i = block_end
    return tradelines


def _looks_like_creditor(name: str) -> bool:
    if not name or len(name) < 2 or len(name) > 70:
        return False
    if _SECTION_HEADER.match(name):
        return False
    if ":" in name:
        return False
    if not _CREDITOR_LINE.match(name):
        return False
    # Require at least one letter.
    return bool(re.search(r"[A-Za-z]", name))


def _find_block_end(lines: list[str], start: int) -> int:
    i = start + 1
    while i < len(lines):
        stripped = lines[i].strip()
        if not stripped:
            i += 1
            continue
        if stripped.lower().startswith("two-year payment history"):
            return i
        if stripped.lower().startswith("days late"):
            return i
        # Next account: creditor-looking line followed by bureau header.
        if _looks_like_creditor(stripped):
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                header = lines[j].strip().lower()
                if "transunion" in header and "experian" in header:
                    return i
        i += 1
    return len(lines)


def _tradeline_from_block(creditor: str, block: str) -> Tradeline | None:
    fields: dict[str, list[str]] = {}
    pending_key = ""
    for raw in block.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        # SmartCredit often prints "Account #" without a colon.
        account_row = re.match(r"(?i)^account\s*#\s*(.*)$", line.strip())
        if account_row:
            fields["account"] = _split_three(account_row.group(1))
            pending_key = "account"
            continue
        label_match = re.match(r"^([^:]{2,40}):\s*(.*)$", line.strip())
        if label_match:
            key = _FIELD_MAP.get(re.sub(r"\s+", " ", label_match.group(1)).strip().lower(), "")
            pending_key = key
            if not key:
                continue
            cols = _split_three(label_match.group(2))
            fields[key] = cols
            continue
        # Wrapped account-number continuation (e.g. trailing **).
        if pending_key == "account" and "account" in fields:
            extra = line.strip()
            if extra and not re.match(r"(?i)^[A-Za-z ].*:", extra):
                for idx in range(3):
                    if fields["account"][idx]:
                        fields["account"][idx] = (fields["account"][idx] + extra).replace(" ", "")
                        break
            continue
        pending_key = ""

    account = fields.get("account", ["", "", ""])
    bureaus: list[BureauCode] = []
    for idx, code in enumerate(("TUC", "EXP", "EQF")):
        if _present(account[idx]) or _bureau_has_data(fields, idx):
            bureaus.append(code)  # type: ignore[arg-type]
    if not bureaus:
        return None

    status = _prefer_field(fields, "payment_status") or _prefer_field(fields, "account_status")
    balance = _prefer_field(fields, "balance")
    past_due = _prefer_field(fields, "past_due")
    account_type = _prefer_field(fields, "account_type")
    high_credit = _prefer_field(fields, "high_credit")
    credit_limit = _prefer_field(fields, "credit_limit")
    date_opened = _prefer_field(fields, "date_opened")
    last_reported = _prefer_field(fields, "last_reported")
    monthly_payment = _prefer_field(fields, "monthly_payment")
    remarks = _prefer_field(fields, "remarks")

    blob = f"{account_type} {status} {remarks}".lower()
    is_collection = "collection" in blob

    return Tradeline(
        id=str(uuid.uuid4()),
        creditor=creditor.strip(),
        account_tu=_clean_account(account[0]),
        account_exp=_clean_account(account[1]),
        account_eqf=_clean_account(account[2]),
        account_type=account_type,
        status=status,
        balance=balance,
        past_due=past_due,
        remarks=remarks,
        credit_limit=credit_limit,
        high_credit=high_credit,
        date_opened=date_opened,
        last_reported=last_reported,
        monthly_payment=monthly_payment,
        bureaus=bureaus,
        is_collection=is_collection,
        selected=False,
        dispute_bureaus=list(bureaus),
    )


def _bureau_has_data(fields: dict[str, list[str]], idx: int) -> bool:
    for key in ("balance", "payment_status", "account_status", "account_type", "date_opened", "high_credit"):
        cols = fields.get(key)
        if cols and idx < len(cols) and _present(cols[idx]):
            return True
    return False


def _prefer_field(fields: dict[str, list[str]], key: str) -> str:
    cols = fields.get(key, ["", "", ""])
    for value in cols:
        if _present(value):
            return value
    return ""


def _clean_account(value: str) -> str:
    if not _present(value):
        return ""
    return re.sub(r"\s+", "", value)


def _present(value: str) -> bool:
    return bool(value) and not _EMPTY.match(value.strip())


def _strip_label_value(value: str) -> str:
    return value.strip()


_MONEY_TOKEN = re.compile(r"\$[\d,]+(?:\.\d{2})?")
_DATE_TOKEN = re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b")
# Include mask stars; do not use \b after digits (Python treats * as a boundary).
_ACCOUNT_TOKEN = re.compile(r"(?<![A-Z0-9*])[A-Z0-9*]{4,}(?![A-Z0-9*])")
_STATUS_PHRASES = tuple(
    sorted(
        (
            "seriously past due date /",
            "paid, was past due 150 days",
            "paid, was past due 120 days",
            "paid, was past due 90 days",
            "paid, was past due 60 days",
            "paid, was past due 30 days",
            "paid or paying as agreed",
            "pays account as agreed",
            "paid satisfactorily",
            "individual account",
            "joint account",
            "current",
            "closed",
            "open",
            "individual",
            "mortgage",
            "revolving account",
            "revolving",
            "installment account",
            "installment",
            "sales contract",
            "charge card",
            "credit card",
            "unsecured loan",
        ),
        key=len,
        reverse=True,
    )
)


def _split_three(value: str) -> list[str]:
    """Split a bureau value row into TransUnion / Experian / Equifax cells.

    pdfplumber collapses the 3-column layout to single spaces, while pdftotext
    -layout keeps wide gaps. Handle both.
    """
    text = value.strip()
    if not text:
        return ["", "", ""]

    wide = [p.strip() for p in re.split(r"\s{2,}", text)]
    if len([p for p in wide if p]) >= 2 or len(wide) >= 3:
        parts = list(wide)
        while len(parts) > 3:
            parts[2] = f"{parts[2]} {parts[3]}".strip()
            del parts[3]
        while len(parts) < 3:
            parts.append("")
        return [_normalize_cell(p) for p in parts[:3]]

    # `--` markers are empty bureau cells in SmartCredit exports.
    if re.search(r"(?:^|\s)--(?:\s|$)", text) or text in {"--", "—"}:
        raw = re.split(r"\s*--\s*", text)
        # "-- $448 --" -> ['', '$448', '']; "-- -- --" -> ['', '', '', '']
        parts = [p.strip() for p in raw]
        while len(parts) > 3 and parts[-1] == "":
            parts.pop()
        if len(parts) == 4 and parts[0] == "" and parts[-1] == "":
            # degenerate "-- -- --" split can yield 4 empties
            parts = parts[:3]
        while len(parts) < 3:
            parts.append("")
        return [_normalize_cell(p) for p in parts[:3]]

    for pattern in (_MONEY_TOKEN, _DATE_TOKEN, _ACCOUNT_TOKEN):
        matches = pattern.findall(text)
        if len(matches) == 3:
            return [_normalize_cell(m) for m in matches]

    words = text.split()
    if len(words) == 3 and len(set(words)) == 1:
        return [_normalize_cell(w) for w in words]

    phrases = _split_known_phrases(text)
    if len(phrases) == 3:
        return [_normalize_cell(p) for p in phrases]

    # Last resort: keep smashed text out of a single bureau by leaving all empty
    # when it clearly looks like three unknown free-text cells.
    return [_normalize_cell(text), "", ""]


def _split_three_names(value: str) -> list[str]:
    """Split `MIKE WEBB MICHAEL WEBB MICHAEL W WEBB` into three bureau names."""
    text = value.strip()
    if not text:
        return ["", "", ""]
    wide = _split_three(text)
    if sum(1 for part in wide if part) >= 2:
        return wide
    tokens = text.split()
    if len(tokens) < 4:
        return [_normalize_cell(text), "", ""]
    from collections import Counter

    counts = Counter(tokens)
    for surname, count in counts.most_common():
        if count != 3:
            continue
        groups: list[str] = []
        current: list[str] = []
        for token in tokens:
            current.append(token)
            if token == surname:
                groups.append(" ".join(current))
                current = []
        if len(groups) == 3 and not current:
            return [_normalize_cell(g) for g in groups]
    return [_normalize_cell(text), "", ""]


def _split_known_phrases(text: str) -> list[str]:
    remaining = text.strip()
    found: list[str] = []
    while remaining and len(found) < 3:
        lower = remaining.lower()
        matched = False
        for phrase in _STATUS_PHRASES:
            if lower.startswith(phrase):
                found.append(remaining[: len(phrase)].strip())
                remaining = remaining[len(phrase) :].strip()
                matched = True
                break
        if not matched:
            break
    if remaining:
        return []
    return found


def _normalize_cell(value: str) -> str:
    text = value.strip()
    if _EMPTY.match(text):
        return ""
    text = text.replace("&apos;", "'")
    return text

