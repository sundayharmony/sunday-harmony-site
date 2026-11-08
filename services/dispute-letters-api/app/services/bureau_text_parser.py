"""Local parsers for bureau PDF text.

Experian consumer disclosures extract as two-column rows smashed onto one line
("Account name … Balance …"). Other bureaus often use "Label: value" or a label
on one line and the value on the next. These parsers only emit a tradeline when
the creditor and at least two account facts are present.
"""

from __future__ import annotations

import re
import uuid

from app.models import BureauCode, ConsumerInfo, ParsedReport, Tradeline

_DATE = re.compile(
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|"
    r"Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}"
    r"|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|"
    r"Dec(?:ember)?)\.?\s+\d{4}"
    r"|\d{1,2}/\d{1,2}/\d{2,4}"
    r"|\d{1,2}/\d{4}",
    re.I,
)
_MONEY = re.compile(r"\$[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b")
_ACCOUNT_NAME_LINE = re.compile(r"(?im)^[ \t]*account\s+name\b")

_LEFT_LABELS: tuple[tuple[str, str], ...] = (
    ("status updated", "status_updated"),
    ("date of first delinquency", "dofd"),
    ("account number", "account_number"),
    ("original creditor", "original_creditor"),
    ("account name", "creditor"),
    ("company sold", "company_sold"),
    ("account type", "account_type"),
    ("date opened", "date_opened"),
    ("payment history", "_stop"),
    ("contact info", "_stop"),
    ("open/closed", "open_closed"),
    ("phone number", "phone"),
    ("comments", "_stop"),
    ("address", "address"),
    ("status", "status"),
)

_RIGHT_LABELS: tuple[str, ...] = (
    "balance updated",
    "original balance",
    "past due amount",
    "highest balance",
    "monthly payment",
    "your statement",
    "credit limit",
    "responsibility",
    "balance",
    "terms",
)

_RIGHT_FIELDS = {
    "balance updated": "balance_updated",
    "original balance": "original_balance",
    "past due amount": "past_due",
    "highest balance": "highest_balance",
    "monthly payment": "monthly_payment",
    "your statement": "your_statement",
    "credit limit": "credit_limit",
    "responsibility": "responsibility",
    "balance": "balance",
    "terms": "terms",
}

_COLON_LABELS = {
    "creditor": "creditor",
    "creditor name": "creditor",
    "company name": "creditor",
    "furnisher": "creditor",
    "subscriber": "creditor",
    "account name": "creditor",
    "account number": "account_number",
    "account #": "account_number",
    "account no": "account_number",
    "account no.": "account_number",
    "acct #": "account_number",
    "acct no": "account_number",
    "status": "status",
    "account status": "status",
    "pay status": "status",
    "payment status": "status",
    "condition": "status",
    "balance": "balance",
    "current balance": "balance",
    "balance amount": "balance",
    "past due": "past_due",
    "past due amount": "past_due",
    "amount past due": "past_due",
    "account type": "account_type",
    "loan type": "account_type",
    "portfolio type": "account_type",
    "type": "account_type",
    "date opened": "date_opened",
    "opened": "date_opened",
    "open date": "date_opened",
    "date closed": "date_closed",
    "date of first delinquency": "dofd",
    "credit limit": "credit_limit",
    "high credit": "high_credit",
    "high balance": "high_credit",
    "highest balance": "high_credit",
    "original balance": "high_credit",
    "monthly payment": "monthly_payment",
    "last reported": "last_reported",
    "balance updated": "last_reported",
    "remarks": "remarks",
    "comments": "remarks",
    "responsibility": "responsibility",
    "original creditor": "original_creditor",
}

_CREDITOR_DENY = {
    "account",
    "account info",
    "account information",
    "account name",
    "accounts",
    "amount past due",
    "balance",
    "closed",
    "closed accounts",
    "collection",
    "collection accounts",
    "comments",
    "contact info",
    "creditor information",
    "credit limit",
    "credit score",
    "credit scores",
    "current payment status",
    "foreclosure",
    "high balance",
    "high credit",
    "inquiries",
    "monthly payment",
    "monthly payment amount",
    "open",
    "open accounts",
    "open date",
    "payment history",
    "personal information",
    "public records",
    "repossession",
    "responsibility",
    "status",
    "terms count",
    "unknown",
    "voluntary",
    "voluntary term source type",
    "voluntary term source type provided",
    "voluntary terms count",
}

# Credit Hero member PDFs print chrome like "Creditor information" / "Voluntary Term..."
# next to the real furnisher name after "charge off". OCR often promotes that chrome.
_HERO_CREDITOR_JUNK = re.compile(
    r"(?i)^(?:"
    r"creditor\s+information|high\s+balance|high\s+credit|"
    r"voluntary(?:\s+term(?:s)?(?:\s+source(?:\s+type(?:\s+provided)?)?)?)?(?:\s+\d+)?|"
    r"terms?(?:\s+count)?(?:\s+\d+)?|repossession|collection|foreclosure|"
    r"account\s+information|amount\s+past\s+due|monthly\s+payment(?:\s+amount)?|"
    r"current\s+payment(?:\s+status)?|open\s+date|account\s+status|account\s+number|"
    r"credit\s+limit|type|responsibility|remarks|po\s+box|as\s+agreed"
    r")(?:\s|$)"
)

_DETAIL_KEYS = (
    "account_number",
    "balance",
    "status",
    "account_type",
    "date_opened",
    "past_due",
    "credit_limit",
    "high_credit",
)


def parse_bureau_text(
    text: str,
    *,
    file_type: str = "pdf",
    ocr_used: bool = False,
    quality: str = "medium",
    file_name: str = "",
) -> ParsedReport | None:
    """Return a report when local rules find real accounts, else None."""
    tradelines, consumer, report_date = parse_bureau_accounts(text, file_name=file_name)
    if not tradelines:
        return None
    return ParsedReport(
        source="fallback_parser",
        report_date=report_date,
        consumer=consumer,
        tradelines=tradelines,
        file_type=file_type,
        ocr_used=ocr_used,
        extraction_quality=quality,
    )


def parse_bureau_accounts(
    text: str, *, file_name: str = ""
) -> tuple[list[Tradeline], ConsumerInfo, str]:
    cleaned = _normalize(text)
    if not cleaned.strip():
        return [], ConsumerInfo(), ""
    bureau = detect_primary_bureau(cleaned, file_name)
    tradelines = _parse_credit_hero(cleaned, bureau)
    if not tradelines:
        tradelines = _parse_experian_blocks(cleaned, bureau)
    if not tradelines:
        tradelines = _parse_labeled_accounts(cleaned, bureau)
    consumer = _consumer_from_text(cleaned) if tradelines else ConsumerInfo()
    report_date = _report_date(cleaned) if tradelines else ""
    return tradelines, consumer, report_date


_HERO_TYPE = (
    "Credit Card",
    "Auto Loan",
    "Automobile",
    "Mortgage",
    "Installment",
    "Student Loan",
    "Charge Account",
    "Collection",
    "Revolving",
    "Secured",
    "Unsecured",
)
_HERO_CREDITOR_CUT = re.compile(
    r"\s+(?:Voluntary|PO BOX|N/A|No data|Account ID|VS\b|Monthly Payment|"
    r"Current Payment|Amount Past|Terms Count|Times 30|Overview)\b",
    re.I,
)
_HERO_CREDITOR_STRIP = re.compile(
    r"(?i)\b(?:"
    r"creditor\s+information|foreclosure|repossession|collection|"
    r"voluntary\s+term(?:s)?(?:\s+source(?:\s+type(?:\s+provided)?)?)?|"
    r"high\s+balance\s*\$?[\d,.]*(?:\.\d{2})?|terms?\s+count\s*\d*|"
    r"\bor\b"
    r")\b"
)


def _parse_credit_hero(text: str, bureau: BureauCode | None) -> list[Tradeline]:
    """Credit Hero member PDFs: one bureau per file, or a 3-column tri-merge."""
    lowered = text.lower()
    has_account_number = "account number" in lowered or "number number number" in lowered
    if not has_account_number or "account status" not in lowered:
        return []
    if not re.search(r"credit\s+limit|open\s+date|vantagescore", lowered):
        return []
    if re.search(r"account\s+status\s+\S+\s+account\s+status", lowered):
        return _parse_credit_hero_tri_merge(text)
    if "overview account details" not in lowered and "accounts listed on your" not in lowered:
        return []
    tradelines: list[Tradeline] = []
    parts = re.split(r"(?i)overview\s+account\s+details", text)
    for part in parts[1:]:
        tradeline = _tradeline_from_fields(_hero_member_fields(part), bureau)
        if tradeline is not None:
            tradelines.append(tradeline)
    return tradelines


def _hero_member_fields(part: str) -> dict[str, str]:
    account_type = _hero_type(part)
    remarks = _hero_remarks(part)
    status = _first(r"Account Status\s+([A-Za-z]+)", part)
    # Digits are required for values like "Late 30 Days". Stop before Credit Hero chrome
    # so OCR does not glue "As Agreed Creditor information" into the payment status.
    payment_status = _clean_payment_status(
        _first(
            r"Current Payment Status\s+(.+?)(?=\s+Amount Past Due|\s+Reported:|"
            r"\s+Overview|\s+Terms(?:\s+Count)?\b|\s+Times\s+30|\s+Creditor information|"
            r"\s+Repossession|\s+High Balance|\s+Voluntary|\s+PO BOX|\s+Account ID|$)",
            part,
        )
    )
    if re.search(r"collection|charge\s*off", remarks, re.I):
        status = _join_remarks(status, "Collection")
    times_late = _first(r"Times\s+30/60/90\s+Days\s+Late\s+(\d+\s*/\s*\d+\s*/\s*\d+)", part)
    payment_history = ""
    if times_late:
        bits = [bit.strip() for bit in times_late.split("/")]
        if len(bits) == 3:
            payment_history = f"Times late 30/60/90: {bits[0]}/{bits[1]}/{bits[2]}"
            if any(bit != "0" for bit in bits):
                payment_status = _join_remarks(payment_status, payment_history)
    return {
        "creditor": _hero_creditor(part),
        "account_number": _first(r"Account Number\s+([A-Z0-9*#xX-]{4,})", part),
        "status": _compose_status(status, payment_status),
        "balance": _first(r"Balance:\s*(\$[\d,]+(?:\.\d{2})?)", part),
        "credit_limit": _first(r"Credit limit:\s*(\$[\d,]+(?:\.\d{2})?)", part),
        "date_opened": _first(
            r"Open Date\s+([A-Za-z]{3,9}\.?\s+\d{1,2},\s+\d{4})",
            part,
        ),
        "account_type": account_type,
        "high_credit": _first(r"High Credit\s+(\$[\d,]+(?:\.\d{2})?)", part),
        "highest_balance": _first(r"High Balance\s+(\$[\d,]+(?:\.\d{2})?)", part),
        "monthly_payment": _first(r"Monthly Payment Amount\s+(\$[\d,]+(?:\.\d{2})?)", part),
        "past_due": _first(r"Amount Past Due\s+(\$[\d,]+(?:\.\d{2})?)", part),
        "payment_history": payment_history,
        "remarks": remarks,
    }


def _parse_credit_hero_tri_merge(text: str) -> list[Tradeline]:
    """One tradeline per account. Columns follow TransUnion, Equifax, Experian."""
    if re.search(r"(?i)account details", text):
        chunks = [
            part
            for part in re.split(r"(?i)account details(?:\s+account details){0,2}", text)
            if re.search(r"(?i)account status|account\s+account\s+account", part)
        ]
    else:
        chunks = re.split(
            r"(?i)(?=account\s+number\s+\S+\s+account\s+number\s+\S+\s+account\s+number)",
            text,
        )
    tradelines: list[Tradeline] = []
    seen: set[tuple[str, str, str]] = set()
    for chunk in chunks:
        accounts = _hero_column_numbers(chunk)
        creditor = _hero_creditor(chunk)
        if not _valid_creditor(creditor):
            continue
        balances = re.findall(r"(?i)balance:\s*(\$[\d,]+(?:\.\d{2})?)", chunk)
        limits = re.findall(r"(?i)credit\s+limit:\s*(\$[\d,]+(?:\.\d{2})?)", chunk)
        opened = _first(r"Open Date\s+([A-Za-z]{3,9}\.?\s+\d{1,2},\s+\d{4})", chunk)
        account_type = _hero_type(chunk)
        status = _first(r"Account Status\s+([A-Za-z]+)", chunk)
        if status.lower() == "charge":
            status = "Charge Off"
        remarks = _hero_remarks(chunk)
        if re.search(r"collection|charge\s*off", remarks, re.I):
            status = _join_remarks(status, "Collection")
        filled = [value for value in accounts if value]
        if len(filled) == 1:
            accounts = [filled[0], filled[0], filled[0]]
        elif len(filled) == 2:
            accounts = [filled[0], filled[1], filled[1]]
        key = (creditor.upper(), _date(opened), accounts[0])
        if key in seen:
            continue
        if sum(1 for value in (accounts[0], status, balances[0] if balances else "", opened, account_type) if value) < 2:
            continue
        seen.add(key)
        tradelines.append(
            Tradeline(
                id=str(uuid.uuid4()),
                creditor=creditor,
                account_tu=accounts[0],
                account_eqf=accounts[1],
                account_exp=accounts[2],
                account_type=account_type,
                status=status,
                balance=balances[0] if balances else "",
                credit_limit=limits[0] if limits else "",
                date_opened=_date(opened),
                remarks=remarks,
                bureaus=["TUC", "EQF", "EXP"],
                is_collection=bool(re.search(r"collection|charge\s*off", f"{status} {remarks}", re.I)),
            )
        )
    return tradelines


def _hero_column_numbers(part: str) -> list[str]:
    """Credit Hero prints TransUnion, then Equifax, then Experian."""
    inline = re.search(
        r"(?i)account\s+number\s+(\S+)\s+account\s+number\s+(\S+)\s+account\s+number\s+(\S+)",
        part,
    )
    stacked = re.search(
        r"(?i)account\s+account\s+account\s+(\S+)\s+(\S+)\s+(\S+)\s+number\s+number\s+number",
        part,
    )
    match = inline or stacked
    if match:
        return [_account_number(match.group(i)) for i in (1, 2, 3)]
    one = re.search(r"(?i)account\s+number\s+([A-Z0-9*#xX-]{4,})", part)
    if one:
        number = _account_number(one.group(1))
        return [number, "", ""] if number else ["", "", ""]
    return ["", "", ""]


def _hero_type(part: str) -> str:
    match = re.search(r"(?i)\bType\s+(" + "|".join(_HERO_TYPE) + r")\b", part)
    return match.group(1).strip() if match else ""


def _hero_remarks(part: str) -> str:
    match = re.search(
        r"(?i)Remarks\s+((?:This Is An Account In Good Standing|Closed Or Paid|Collection|Charge(?:\s|-)?off)[^A-Z\n]{0,60})",
        part,
    )
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).strip()


def _clean_payment_status(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value or "").strip(" -")
    if not cleaned:
        return ""
    # Keep short status phrases; drop trailing OCR chrome if any slipped through.
    cleaned = re.split(
        r"(?i)\s+(?:creditor information|repossession|voluntary|high balance|po box)\b",
        cleaned,
        maxsplit=1,
    )[0].strip(" -")
    return cleaned[:60]


def _is_hero_creditor_junk(name: str) -> bool:
    cleaned = re.sub(r"\s+", " ", name or "").strip(" -")
    if not cleaned:
        return True
    if _HERO_CREDITOR_JUNK.search(cleaned):
        return True
    lowered = cleaned.lower()
    if lowered in _CREDITOR_DENY:
        return True
    # "Voluntary Terms Count 66" and similar label+number chrome.
    if re.fullmatch(r"(?i)voluntary(?:\s+\w+){0,6}(?:\s+\d+)?", cleaned):
        return True
    if re.fullmatch(r"(?i)(?:high\s+balance|terms?\s+count|creditor\s+information)(?:\s+\S+){0,3}", cleaned):
        return True
    return False


def _hero_creditor(part: str) -> str:
    """Creditor sits after Credit Hero's 'charge off' chrome; skip OCR-promoted labels."""
    matches = list(re.finditer(r"(?i)charge\s+off\s+", part))
    for match in reversed(matches):
        rest = part[match.end() : match.end() + 140]
        rest = _HERO_CREDITOR_CUT.split(rest, maxsplit=1)[0]
        rest = _HERO_CREDITOR_STRIP.sub(" ", rest)
        rest = re.sub(r"\s+", " ", rest).strip(" -")
        # Prefer the leading ALL-CAPS furnisher token(s), not trailing address crumbs.
        candidate = rest
        caps = re.match(r"([A-Z][A-Z0-9&/.'-]{1,40}(?:\s+[A-Z][A-Z0-9&/.'-]{1,40}){0,4})", rest)
        if caps:
            candidate = caps.group(1).strip(" -")
        if _is_hero_creditor_junk(candidate) or not _valid_creditor(candidate):
            continue
        if re.fullmatch(
            r"(?:bankruptcy|foreclosure|repossession|collection|voluntary surrender|no data available)",
            candidate,
            re.I,
        ):
            continue
        return candidate
    return ""


def _first(pattern: str, text: str) -> str:
    match = re.search(pattern, text, re.I)
    return match.group(1).strip() if match else ""


def detect_primary_bureau(text: str, file_name: str = "") -> BureauCode | None:
    name = file_name or ""
    if re.search(r"experian", name, re.I):
        return "EXP"
    if re.search(r"trans[\s_-]*union", name, re.I):
        return "TUC"
    if re.search(r"equifax", name, re.I):
        return "EQF"
    head = (text or "")[:8000].lower()
    counts = {
        "EXP": len(re.findall(r"experian", head)),
        "TUC": len(re.findall(r"trans\s*union", head)),
        "EQF": len(re.findall(r"equifax", head)),
    }
    best = max(counts, key=lambda key: counts[key])
    ordered = sorted(counts.values(), reverse=True)
    if counts[best] <= 0 or ordered[0] == ordered[1]:
        return None
    return best  # type: ignore[return-value]


def _parse_experian_blocks(text: str, bureau: BureauCode | None) -> list[Tradeline]:
    lowered = text.lower()
    if "account name" not in lowered:
        return []
    if not any(token in lowered for token in ("balance updated", "open/closed", "account info")):
        return []
    matches = list(_ACCOUNT_NAME_LINE.finditer(text))
    tradelines: list[Tradeline] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        prelude = text[max(0, match.start() - 400) : match.start()]
        fields = _parse_experian_block(text[match.start() : end], prelude)
        tradeline = _tradeline_from_fields(fields, bureau)
        if tradeline is not None:
            tradelines.append(tradeline)
    return tradelines


def _parse_experian_block(block: str, prelude: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    current = ""
    stopped = False
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        left_key, payload = _match_left(line)
        if left_key == "_stop":
            stopped = True
            current = ""
            continue
        if stopped:
            continue
        if left_key:
            left_value, right_label, right_value = _split_right(payload)
            if left_key == "creditor":
                fields["creditor"] = left_value
            elif left_key == "account_number":
                fields["account_number"] = left_value
            elif left_key == "date_opened":
                fields["date_opened"] = _date(left_value) or left_value
            elif left_key == "dofd":
                fields["dofd"] = _date(left_value) or left_value
            else:
                fields[left_key] = left_value
            if right_label and right_label in _RIGHT_FIELDS:
                fields[_RIGHT_FIELDS[right_label]] = right_value
            current = left_key
            continue
        right_label, right_value = _match_right_only(line)
        if right_label and right_label in _RIGHT_FIELDS:
            fields[_RIGHT_FIELDS[right_label]] = right_value
            continue
        if current in {"status", "creditor", "original_creditor", "address"}:
            fields[current] = f"{fields.get(current, '')} {line}".strip()

    badge = re.search(r"potentially\s+negative\s+(open|closed)\b", prelude, re.I)
    if badge and not _blankish(fields.get("open_closed", "")):
        fields["open_closed"] = badge.group(1)
    if not _blankish(fields.get("original_creditor", "")):
        original = re.search(r"original\s+creditor\s*:\s*(.+)", prelude, re.I)
        if original:
            fields["original_creditor"] = original.group(1).splitlines()[0].strip()
    return fields


def _parse_labeled_accounts(text: str, bureau: BureauCode | None) -> list[Tradeline]:
    records = _labeled_records(text)
    tradelines: list[Tradeline] = []
    for fields in records:
        tradeline = _tradeline_from_fields(fields, bureau)
        if tradeline is not None:
            tradelines.append(tradeline)
    return tradelines


def _labeled_records(text: str) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    current: dict[str, str] = {}
    pending = ""
    lines = [line.strip() for line in text.splitlines()]

    def assign(label: str, value: str) -> None:
        nonlocal current
        if label == "creditor" and current.get("creditor") and _detail_count(current) > 0:
            records.append(dict(current))
            current = {}
        if label == "balance":
            current["balance"] = _money(value) or _blankish(value)
        elif label in {"date_opened", "dofd", "date_closed", "last_reported"}:
            current[label] = _date(value) or _blankish(value)
        elif label == "account_number":
            current["account_number"] = value
        elif label in {"past_due", "credit_limit", "high_credit", "monthly_payment"}:
            current[label] = _money(value) or _blankish(value)
        else:
            current[label] = _blankish(value)

    for line in lines:
        if not line:
            pending = ""
            continue
        if pending:
            assign(pending, line)
            pending = ""
            continue
        colon = re.match(r"^([^:]{2,40}):\s*(.+)$", line)
        if colon:
            label = _canon_label(colon.group(1))
            if label:
                assign(label, colon.group(2).strip())
                continue
        exact = _canon_label(line)
        if exact:
            pending = exact
    if current:
        records.append(dict(current))
    return records


def _tradeline_from_fields(fields: dict[str, str], bureau: BureauCode | None) -> Tradeline | None:
    creditor = _blankish(fields.get("creditor", ""))
    if not _valid_creditor(creditor) or _is_hero_creditor_junk(creditor):
        return None
    account_number = _account_number(fields.get("account_number", ""))
    balance = _money(fields.get("balance", ""))
    past_due = _money(fields.get("past_due", ""))
    credit_limit = _money(fields.get("credit_limit", ""))
    high_credit = _money(fields.get("high_credit", "")) or _money(fields.get("highest_balance", ""))
    if not high_credit:
        high_credit = _money(fields.get("original_balance", ""))
    date_opened = _date(fields.get("date_opened", ""))
    dofd = _date(fields.get("dofd", ""))
    last_reported = _date(fields.get("balance_updated", "")) or _date(fields.get("last_reported", ""))
    if not last_reported:
        last_reported = _date(fields.get("status_updated", ""))
    account_type = _blankish(fields.get("account_type", ""))
    status = _compose_status(fields.get("open_closed", ""), fields.get("status", ""))
    payment_history = _blankish(fields.get("payment_history", ""))
    if _detail_count(
        {
            "account_number": account_number,
            "balance": balance,
            "status": status,
            "account_type": account_type,
            "date_opened": date_opened,
            "past_due": past_due,
            "credit_limit": credit_limit,
            "high_credit": high_credit,
        }
    ) < 2:
        return None

    remarks = _remarks(fields)
    blob = f"{account_type} {status}".lower()
    is_collection = "collection" in blob
    account_tu = account_number if bureau == "TUC" else ""
    account_exp = account_number if bureau == "EXP" else ""
    account_eqf = account_number if bureau == "EQF" else ""
    bureaus: list[BureauCode] = [bureau] if bureau else []
    if not bureau and account_number:
        remarks = _join_remarks(remarks, f"Account number: {account_number}")
    return Tradeline(
        id=str(uuid.uuid4()),
        creditor=creditor,
        account_tu=account_tu,
        account_exp=account_exp,
        account_eqf=account_eqf,
        account_type=account_type,
        status=status,
        balance=balance,
        past_due=past_due,
        remarks=remarks,
        credit_limit=credit_limit,
        high_credit=high_credit,
        date_opened=date_opened,
        date_of_first_delinquency=dofd,
        last_reported=last_reported,
        payment_history=payment_history,
        monthly_payment=_money(fields.get("monthly_payment", "")),
        bureaus=bureaus,
        is_collection=is_collection,
    )


def _remarks(fields: dict[str, str]) -> str:
    parts: list[str] = []
    original = _blankish(fields.get("original_creditor", ""))
    if original and original.lower() not in {fields.get("creditor", "").strip().lower()}:
        parts.append(f"Original creditor: {original}")
    sold = _blankish(fields.get("company_sold", ""))
    if sold:
        parts.append(f"Company sold: {sold}")
    terms = _blankish(fields.get("terms", ""))
    if terms:
        parts.append(f"Terms: {terms}")
    responsibility = _blankish(fields.get("responsibility", ""))
    if responsibility:
        parts.append(f"Responsibility: {responsibility}")
    statement = _blankish(fields.get("your_statement", ""))
    if statement:
        parts.append(f"Statement: {statement}")
    extra = _blankish(fields.get("remarks", ""))
    if extra:
        parts.append(extra)
    return _join_remarks(*parts)


def _join_remarks(*parts: str) -> str:
    text = "; ".join(part for part in parts if part)
    return text[:500]


def _compose_status(open_closed: str, status: str) -> str:
    state = _blankish(open_closed)
    body = re.sub(r"\s+", " ", status or "").strip(" -")
    if state and state.lower() not in body.lower():
        return f"{state}. {body}".strip(". ") if body else state
    return body or state


def _detail_count(fields: dict[str, str]) -> int:
    return sum(1 for key in _DETAIL_KEYS if _blankish(fields.get(key, "")))


def _valid_creditor(name: str) -> bool:
    cleaned = re.sub(r"\s+", " ", name or "").strip(" -")
    if len(cleaned) < 3 or len(cleaned) > 120:
        return False
    if not re.search(r"[A-Za-z]", cleaned):
        return False
    lowered = cleaned.lower()
    if lowered in _CREDITOR_DENY:
        return False
    if _is_hero_creditor_junk(cleaned):
        return False
    return True


def _match_left(line: str) -> tuple[str, str]:
    lowered = line.lower()
    for label, key in _LEFT_LABELS:
        if lowered.startswith(label):
            return key, line[len(label) :].lstrip(" :.-")
    return "", ""


def _right_label_matches(lowered: str) -> list[tuple[int, int, str]]:
    """Non-overlapping right-column labels as (index, negative length, label)."""
    raw: list[tuple[int, int, str]] = []
    for label in _RIGHT_LABELS:
        start = 0
        while True:
            idx = lowered.find(label, start)
            if idx < 0:
                break
            end = idx + len(label)
            before_ok = idx == 0 or not lowered[idx - 1].isalnum()
            after_ok = end == len(lowered) or not lowered[end].isalnum()
            if before_ok and after_ok:
                raw.append((idx, len(label), label))
            start = idx + 1
    kept: list[tuple[int, int, str]] = []
    for idx, length, label in raw:
        end = idx + length
        covered = any(
            other_idx <= idx and other_idx + other_len >= end and (other_idx, other_len) != (idx, length)
            for other_idx, other_len, _other in raw
        )
        if not covered:
            kept.append((idx, -length, label))
    return kept


def _split_right(payload: str) -> tuple[str, str, str]:
    matches = _right_label_matches(payload.lower())
    if not matches:
        return payload.strip(), "", ""
    later = [match for match in matches if match[0] > 0]
    # A hit at column 0 is the right column only when the left value was blank.
    # If another label follows, the first hit is part of the creditor or status text.
    idx, _neg_len, label = min(later or matches)
    left = payload[:idx].strip(" -")
    right = payload[idx + len(label) :].strip(" -:")
    return left, label, right


def _match_right_only(line: str) -> tuple[str, str]:
    lowered = line.lower().strip()
    for label in sorted(_RIGHT_LABELS, key=len, reverse=True):
        if lowered == label or lowered.startswith(label + " ") or lowered.startswith(label + ":"):
            return label, line.strip()[len(label) :].strip(" -:")
    return "", ""


def _canon_label(label: str) -> str:
    key = re.sub(r"\s+", " ", label).strip(" :.-").lower()
    return _COLON_LABELS.get(key, "")


def _consumer_from_text(text: str) -> ConsumerInfo:
    match = re.search(
        r"prepared\s+for\s+([A-Za-z][A-Za-z .'-]{2,80}?)\s+date\s+generated",
        text,
        re.I,
    )
    if not match:
        return ConsumerInfo()
    name = re.sub(r"\s+", " ", match.group(1)).strip()
    if any(ch.isdigit() for ch in name) or len(name.split()) > 6:
        return ConsumerInfo()
    return ConsumerInfo(name=name)


def _report_date(text: str) -> str:
    match = re.search(
        r"date\s+generated:\s*([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})",
        text,
        re.I,
    )
    return match.group(1).strip() if match else ""


def _normalize(text: str) -> str:
    text = re.sub(r"[\ue000-\uf8ff]", "", text or "")
    text = text.replace("\u00a0", " ")
    return text


def _blankish(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value or "").strip(" -")
    if cleaned.lower() in {"", "-", "--", "n/a", "na", "none", "not reported", "data unavailable"}:
        return ""
    return cleaned


def _money(value: str) -> str:
    match = _MONEY.search(value or "")
    return match.group(0) if match else ""


def _date(value: str) -> str:
    match = _DATE.search(value or "")
    return re.sub(r"\s+", " ", match.group(0)).strip() if match else ""


_ACCOUNT_NUMBER_WORDS = {
    "balance",
    "closed",
    "current",
    "individual",
    "number",
    "status",
    "unknown",
    "updated",
}


def _account_number(value: str) -> str:
    cleaned = _blankish(value)
    match = re.search(r"[A-Za-z0-9*][A-Za-z0-9*\-]{3,}", cleaned)
    if not match:
        return ""
    token = match.group(0)
    if token.lower() in _ACCOUNT_NUMBER_WORDS:
        return ""
    digits = re.sub(r"\D", "", token)
    if "*" in token or len(digits) >= 4:
        return token
    # A few furnishers print a letter-only account id.
    if re.fullmatch(r"[A-Za-z]{5,12}", token):
        return token
    return ""
