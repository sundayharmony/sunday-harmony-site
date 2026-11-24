"""Check a read against the totals the report prints about itself.

Most reports state their own counts ("Total Accounts: 11 8 7", "Open accounts 7",
"Hard Inquiries (18 Total)", a "12 Credit cards / 2 Auto loans" strip). When what was
read disagrees, staff are told before letters go out. Plain text rules only.
"""
from __future__ import annotations

import re

from app.models import BureauCode, ParsedReport, Tradeline

THREE_BUREAUS: tuple[BureauCode, ...] = ("TUC", "EXP", "EQF")  # IdentityIQ's column order
_BUREAU_WORD = {"transunion": "TUC", "experian": "EXP", "equifax": "EQF"}
_NAMES = {"TUC": "TransUnion", "EXP": "Experian", "EQF": "Equifax"}
_ROW = re.compile(r"(?im)^[^\S\n]*\W{0,2}(total) accounts:?[^\S\n]+(\d{1,3})(?:[^\S\n]+(\d{1,3})[^\S\n]+(\d{1,3}))?(?![\d,.])")
_CATEGORIES = ("credit cards", "real estate", "auto loans", "student loans", "other")


def _is_inquiry(tl: Tradeline) -> bool:
    return "inquir" in f"{tl.account_type} {tl.item_category}".lower()


def _is_public_record(tl: Tradeline) -> bool:
    return "public record" in f"{tl.account_type} {tl.item_category}".lower()


def stated_account_totals(text: str) -> dict[str, int]:
    """Accounts the report says it holds, keyed by bureau code, or "ALL" for a one-bureau report."""
    found: dict[str, dict[str, list[int]]] = {}
    for match in _ROW.finditer(text or ""):
        kind = match.group(1).lower()
        values = [int(v) for v in match.groups()[1:] if v is not None]
        found.setdefault(kind, {"values": values})
    if not found:
        # Monitoring sites: "Balances Payments Open accounts Closed accounts" over "$38,655 $1,104 14 27".
        lines = (text or "").splitlines()
        for i, line in enumerate(lines[:120]):
            if re.search(r"(?i)open accounts\s+closed accounts\s*$", line):
                nxt = next((ln for ln in lines[i + 1 : i + 4] if ln.strip()), "")
                ints = [int(v) for v in re.findall(r"(?<![$\d,.])(\d{1,3})(?![\d,.])", nxt)]
                if len(ints) >= 2:
                    return {"ALL": ints[-2] + ints[-1]}
        return {}
    # Only "Total accounts" is trusted: single-bureau sites' "Open accounts 7" counts
    # something narrower than every account on the report.
    values = found["total"]["values"]
    if len(values) == 3:
        return dict(zip(_column_order(text), values))
    return {"ALL": values[0]}


def _column_order(text: str) -> tuple[BureauCode, ...]:
    """Bureau column order from the report's own header (Credit Hero: TU, EQF, EXP)."""
    match = re.search(r"(?i)(transunion|experian|equifax)\W+(transunion|experian|equifax)\W+(transunion|experian|equifax)", text or "")
    if match and len({g.lower() for g in match.groups()}) == 3:
        return tuple(_BUREAU_WORD[g.lower()] for g in match.groups())  # type: ignore[return-value]
    if re.search(r"(?i)credit\s*hero", text or ""):
        return ("TUC", "EQF", "EXP")
    return THREE_BUREAUS


def stated_categories(text: str) -> dict[str, int]:
    """'12 Credit cards 0 Real estate 2 Auto loans 0 Student loans 25 Other' strip on monitoring sites."""
    lines = (text or "").splitlines()
    for i, line in enumerate(lines[:200]):
        if re.search(r"(?i)credit cards\s+real estate\s+auto loans\s+student loans\s+other", line) and i:
            ints = [int(v) for v in re.findall(r"(?<![\d,.$])(\d{1,3})(?![\d,.])", lines[i - 1])]
            if len(ints) == 5:
                return dict(zip(_CATEGORIES, ints))
    return {}


def stated_inquiries(text: str) -> int | None:
    match = re.search(r"(?i)hard inquiries\s*\((\d{1,3}) total\)", text or "")
    return int(match.group(1)) if match else None


def check_read(report: ParsedReport, text: str) -> list[str]:
    """Plain-English warnings where the read disagrees with the report's own totals."""
    warnings: list[str] = []
    # "Total accounts" on reports counts tradelines only, not inquiries or public records.
    accounts = [t for t in report.tradelines if not _is_inquiry(t) and not _is_public_record(t)]
    for key, stated in stated_account_totals(text).items():
        if key == "ALL":
            read = len(accounts)
            where = "This report"
        else:
            read = sum(1 for t in accounts if key in (t.bureaus or []))
            where = _NAMES[key]
        if read != stated:
            warnings.append(f"{where} lists {stated} accounts; {read} were read.")
    stated_inq = stated_inquiries(text)
    read_inq = sum(1 for t in report.tradelines if _is_inquiry(t))
    if stated_inq is not None and stated_inq != read_inq:
        warnings.append(f"Report lists {stated_inq} hard inquiries; {read_inq} were read.")
    return warnings
