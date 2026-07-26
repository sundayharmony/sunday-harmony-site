"""Parse currency and date-ish strings from credit report extractions."""

from __future__ import annotations

import re
from datetime import date, datetime

_MONEY_RE = re.compile(
    r"(?P<neg>-)?\s*\$?\s*(?P<num>\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)",
)
_DATE_PATTERNS = (
    "%m/%d/%Y",
    "%m/%d/%y",
    "%Y-%m-%d",
    "%b %d, %Y",
    "%B %d, %Y",
    "%m-%d-%Y",
    "%Y/%m/%d",
)


def parse_money(value: str | None) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"n/a", "na", "none", "-", "—", "not reported"}:
        return None
    match = _MONEY_RE.search(text.replace(" ", ""))
    if not match:
        # try looser: digits only after stripping $
        digits = re.sub(r"[^\d.-]", "", text)
        if not digits or digits in {".", "-", "-."}:
            return None
        try:
            return float(digits)
        except ValueError:
            return None
    num = float(match.group("num").replace(",", ""))
    if match.group("neg") or text.lstrip().startswith("("):
        num = -abs(num)
    return num


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    # Take first date-like token
    token = re.split(r"[|;]", text)[0].strip()
    for fmt in _DATE_PATTERNS:
        try:
            return datetime.strptime(token, fmt).date()
        except ValueError:
            continue
    # MM/YYYY
    m = re.match(r"^(\d{1,2})/(\d{4})$", token)
    if m:
        try:
            return date(int(m.group(2)), int(m.group(1)), 1)
        except ValueError:
            return None
    return None


def months_between(later: date, earlier: date) -> int:
    return (later.year - earlier.year) * 12 + (later.month - earlier.month)
