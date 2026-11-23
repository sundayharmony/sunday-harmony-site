from __future__ import annotations

import re

from app.models import (
    BureauCode,
    ExtractedDocument,
    ParsedReport,
    Tradeline,
)
from app.parsers.base import parse_document_fallback
from app.services.bureau_scores import fill_missing_scores
from app.services.credit_health import apply_high_priority_selection, build_health_summary
from app.services.credit_intelligence import build_credit_intelligence

def real_account_count(report: ParsedReport) -> int:
    """Tradelines that look like furnished accounts, not empty or inquiry rows."""
    return sum(1 for tl in report.tradelines if _is_real_account(tl))


_FIELD_LABEL_CREDITOR = re.compile(
    r"(?i)^(?:"
    r"payment amount|monthly payment|account #|account number|high balance|"
    r"balance owed|past due|credit limit|date opened|payment status|"
    r"account status|account type|subscriber|creditor remarks"
    r")\s*:?\s*$"
)


def _is_real_account(tl: Tradeline) -> bool:
    creditor = (tl.creditor or "").strip()
    if len(creditor) < 2 or creditor.lower() in {"unknown", "n/a", "none"}:
        return False
    if _FIELD_LABEL_CREDITOR.match(creditor):
        return False
    kind = f"{tl.account_type} {tl.item_category} {tl.status}".lower()
    if "inquir" in kind:
        return False
    details = (
        tl.account_tu,
        tl.account_exp,
        tl.account_eqf,
        tl.balance,
        tl.status,
        tl.account_type,
        tl.date_opened,
        tl.past_due,
    )
    return any((value or "").strip() for value in details)


def analyze_report(doc: ExtractedDocument, *, allow_fallback: bool = True, file_name: str = "") -> ParsedReport:
    """Sync entry point; runs the async parser on a fresh event loop when needed."""
    import asyncio
    import concurrent.futures

    def _run() -> ParsedReport:
        return asyncio.run(
            analyze_report_async(doc, allow_fallback=allow_fallback, file_name=file_name)
        )

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return _run()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(_run).result()


async def analyze_report_async(
    doc: ExtractedDocument, *, allow_fallback: bool = True, file_name: str = ""
) -> ParsedReport:
    """Parse the report locally. No report text leaves this service."""
    local = _apply_fallback(doc, "local parse", file_name=file_name)
    from app.services.bureau_text_parser import detect_primary_bureau
    from app.services.inquiries import add_inquiries

    add_inquiries(local, doc, detect_primary_bureau(doc.text or "", file_name))
    count = real_account_count(local)
    if count > 0:
        local.analysis_summary = f"Parsed {count} account(s) locally from the uploaded report."
    elif allow_fallback:
        local.analysis_summary = "Parsed locally. No accounts matched a known report layout."
    else:
        raise RuntimeError("No accounts matched a known report layout")
    return _finalize_report(local, file_name=file_name, doc=doc)


def _valid_bureaus(codes: list) -> list[BureauCode]:
    return [b for b in codes if b in ("TUC", "EXP", "EQF")]


def _finalize_report(
    report: ParsedReport,
    agent_health: dict | None = None,
    *,
    file_name: str = "",
    html: str = "",
    text: str = "",
    doc: ExtractedDocument | None = None,
) -> ParsedReport:
    from app.services.bureau_coverage import apply_bureau_coverage

    source_html = html or (doc.html if doc else "") or ""
    source_text = text or (doc.text if doc else "") or source_html
    fill_missing_scores(
        report, html=source_html, text=source_text, file_name=file_name, ocr=bool(doc and doc.ocr_used)
    )
    report.credit_health = build_health_summary(report, agent_health)
    report = apply_high_priority_selection(report)
    report.credit_intelligence = build_credit_intelligence(report)
    report = apply_bureau_coverage(report, file_name=file_name)
    return report


def _apply_fallback(doc: ExtractedDocument, reason: str, file_name: str = "") -> ParsedReport:
    report = parse_document_fallback(doc, file_name=file_name)
    report.source = "fallback_parser"
    if not report.analysis_summary:
        report.analysis_summary = f"Parsed locally ({reason})"
    for tl in report.tradelines:
        if not tl.dispute_bureaus:
            tl.dispute_bureaus = list(tl.bureaus)
        if not tl.analysis_notes:
            tl.analysis_notes = f"Status: {tl.status}; Balance: {tl.balance}"
    return report
