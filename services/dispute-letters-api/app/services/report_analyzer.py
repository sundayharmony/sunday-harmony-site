from __future__ import annotations

import json
import os
import re
import uuid

from app.config import PROJECT_ROOT
from app.models import (
    BureauCode,
    ConsumerInfo,
    ExtractedDocument,
    ParsedReport,
    Subscriber,
    Tradeline,
)
from app.parsers.base import parse_document_fallback
from app.services.credit_health import apply_high_priority_selection, build_health_summary
from app.services.credit_intelligence import build_credit_intelligence
from app.services.cursor_client import agent_prompt, result_text

ANALYZE_PROMPT = """You are a credit report analyst with access to federal consumer credit law references in this project.

Before analyzing, read these files in the project:
- knowledge/fcra/key-sections.md
- knowledge/citations.yaml
- knowledge/credit-intelligence/factor-framework.md
- .cursor/skills/credit-letter-legal/SKILL.md

Analyze the credit report text below. Extract ONLY information visible in the report. Do NOT invent accounts.

CLEAN CREDIT PROFILE PRIORITY (critical):
- Prioritize items that should be REMOVED to clean the profile: collections, charge-offs, and closed/paid accounts that still show late payments, delinquencies, or other negatives.
- Closed or paid accounts with negative history are high-value dispute targets — request deletion, not cosmetic fixes.
- Do NOT prioritize healthy open accounts in good standing (those help the profile).
- In suggested_dispute_reason, lead with deletion language for obsolete/closed negatives (FCRA §611).
- Tag legal_flags with "closed_account", "closed_derogatory", and/or "obsolete_negative" when applicable.

CREDIT INTELLIGENCE EXTRACTION (critical for utilization / age / funding readiness):
- Extract credit_limit, high_credit, date_opened, date_of_first_delinquency, last_reported, payment_history, monthly_payment whenever visible.
- For hard inquiries, still create tradeline-like rows with account_type containing "Inquiry".
- For public records (bankruptcy, judgment, lien), include them as tradelines with clear account_type/status.

For each tradeline, provide:
- Factual fields (creditor, account numbers per bureau, status, balance, limits, dates, etc.)
- analysis_notes: brief summary of potential issues (inaccuracies, collections, disputed status, closed negatives, utilization concerns, etc.)
- suggested_dispute_reason: FCRA-grounded dispute reason citing applicable law (e.g. FCRA §611); for closed/obsolete negatives, explicitly ask for deletion
- dispute_bureaus: which bureaus to send dispute letters to (subset of bureaus reporting)
- dispute_furnisher: true if a furnisher letter is recommended
- legal_flags: array of tags like "collection", "charge_off", "already_disputed", "balance_mismatch", "late_payment_error", "closed_account", "closed_derogatory", "obsolete_negative", "high_utilization"

Return ONLY valid JSON (no markdown fences, no prose outside JSON) matching this schema:
{{
  "analysis_summary": "overall report summary covering strengths, weaknesses, and clean-profile removal targets",
  "reference": "report reference number if present",
  "report_date": "report date if present",
  "consumer": {{"name": "", "dob": "", "ssn_last4": "", "addresses": []}},
  "tradelines": [{{
    "creditor": "", "account_tu": "", "account_exp": "", "account_eqf": "",
    "account_type": "", "status": "", "balance": "", "past_due": "", "remarks": "",
    "credit_limit": "", "high_credit": "", "date_opened": "",
    "date_of_first_delinquency": "", "last_reported": "",
    "payment_history": "", "monthly_payment": "",
    "bureaus": ["TUC"|"EXP"|"EQF"], "is_collection": false,
    "analysis_notes": "", "suggested_dispute_reason": "",
    "dispute_bureaus": ["TUC"|"EXP"|"EQF"], "dispute_furnisher": true,
    "legal_flags": []
  }}],
  "subscribers": [{{"name": "", "address_lines": [], "phone": ""}}],
  "credit_health": {{
    "scores": {{"tuc": null, "exp": null, "eqf": null}},
    "repair_summary": "brief overview focused on deleting closed/obsolete negatives first",
    "recommended_actions": ["action 1", "action 2"]
  }}
}}

Credit report text:
---
{text}
---
"""


def cursor_api_configured() -> bool:
    return bool(os.environ.get("CURSOR_API_KEY", "").strip())


def analyze_report(doc: ExtractedDocument, *, allow_fallback: bool = True, file_name: str = "") -> ParsedReport:
    """Sync entry point; runs the async agent on a fresh event loop when needed."""
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
    if not cursor_api_configured():
        if allow_fallback:
            return _finalize_report(
                _apply_fallback(doc, "CURSOR_API_KEY not set"), file_name=file_name
            )
        raise RuntimeError("CURSOR_API_KEY is required for report analysis")

    text = _prepare_report_text(doc)
    if len(text.strip()) < 50:
        if allow_fallback:
            return _finalize_report(
                _apply_fallback(doc, "insufficient text extracted"), file_name=file_name
            )
        raise RuntimeError("Could not extract enough text from the uploaded file")

    try:
        report, agent_health = await _analyze_via_agent(doc, text)
        return _finalize_report(report, agent_health, file_name=file_name)
    except Exception as first_error:
        try:
            report, agent_health = await _analyze_via_agent(doc, text, retry_strict=True)
            return _finalize_report(report, agent_health, file_name=file_name)
        except Exception:
            if allow_fallback:
                report = _apply_fallback(doc, str(first_error))
                report.analysis_summary = (
                    f"Agent analysis failed; used fallback parser. ({first_error})"
                )
                return _finalize_report(report, file_name=file_name)
            raise


def _prepare_report_text(doc: ExtractedDocument) -> str:
    text = doc.html or doc.text
    if doc.html and len(text) > 120000:
        text = _clip_html_for_agent(doc.html)
    return text[:120000]


def _clip_html_for_agent(html: str) -> str:
    """Keep personal info, tradeline tables, and subscriber directory from large HTML."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    parts: list[str] = []
    for header in soup.select(".rpt_fullReport_header"):
        parts.append(header.get_text(" ", strip=True))
    for div in soup.select("div.sub_header"):
        parts.append("\n--- ACCOUNT ---")
        parts.append(div.get_text(" ", strip=True))
        table = div.find_next("table")
        if table:
            parts.append(table.get_text("\n", strip=True))
    for row in soup.select("tr[ng-repeat*='subsr in subscribers']"):
        parts.append(row.get_text("\n", strip=True))
    clipped = "\n".join(parts)
    return clipped if len(clipped) > 500 else html[:120000]


async def _analyze_via_agent(
    doc: ExtractedDocument, text: str, retry_strict: bool = False
) -> tuple[ParsedReport, dict | None]:
    prompt = ANALYZE_PROMPT.format(text=text)
    if retry_strict:
        prompt += "\n\nIMPORTANT: Return ONLY valid JSON. No markdown. No explanation."

    result = await agent_prompt(prompt)
    raw = result_text(result)
    data = _parse_json_from_response(raw)
    return _dict_to_report(data, doc, raw, source="cursor_agent"), data.get("credit_health")


def _parse_json_from_response(raw: str) -> dict:
    raw = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fence:
        raw = fence.group(1).strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        raw = raw[start : end + 1]
    return json.loads(raw)


def _dict_to_report(
    data: dict,
    doc: ExtractedDocument,
    raw: str,
    source: str,
) -> ParsedReport:
    consumer_data = data.get("consumer") or {}
    consumer = ConsumerInfo(
        name=consumer_data.get("name", ""),
        dob=consumer_data.get("dob", ""),
        ssn_last4=consumer_data.get("ssn_last4", ""),
        addresses=consumer_data.get("addresses") or [],
    )
    tradelines: list[Tradeline] = []
    for item in data.get("tradelines") or []:
        bureaus = _valid_bureaus(item.get("bureaus") or [])
        dispute_bureaus = _valid_bureaus(item.get("dispute_bureaus") or bureaus)
        suggested = item.get("suggested_dispute_reason", "")
        tradelines.append(
            Tradeline(
                id=str(uuid.uuid4()),
                creditor=item.get("creditor", "Unknown"),
                account_tu=item.get("account_tu", ""),
                account_exp=item.get("account_exp", ""),
                account_eqf=item.get("account_eqf", ""),
                account_type=item.get("account_type", ""),
                status=item.get("status", ""),
                balance=item.get("balance", ""),
                past_due=item.get("past_due", ""),
                remarks=item.get("remarks", ""),
                credit_limit=item.get("credit_limit", ""),
                high_credit=item.get("high_credit", ""),
                date_opened=item.get("date_opened", ""),
                date_of_first_delinquency=item.get("date_of_first_delinquency", ""),
                last_reported=item.get("last_reported", ""),
                payment_history=item.get("payment_history", ""),
                monthly_payment=item.get("monthly_payment", ""),
                bureaus=bureaus,
                is_collection=bool(item.get("is_collection"))
                or "collection" in (item.get("account_type") or "").lower(),
                analysis_notes=item.get("analysis_notes", ""),
                suggested_dispute_reason=suggested,
                dispute_reason=suggested,
                dispute_bureaus=dispute_bureaus,
                dispute_furnisher=bool(item.get("dispute_furnisher", True)),
                legal_flags=item.get("legal_flags") or [],
            )
        )
    subscribers = [
        Subscriber(
            name=s.get("name", ""),
            address_lines=s.get("address_lines") or [],
            phone=s.get("phone", ""),
        )
        for s in (data.get("subscribers") or [])
        if s.get("name")
    ]
    quality = doc.extraction_quality
    if source == "cursor_agent" and tradelines:
        quality = "high"
    return ParsedReport(
        source=source,
        reference=data.get("reference", ""),
        report_date=data.get("report_date", ""),
        analysis_summary=data.get("analysis_summary", ""),
        consumer=consumer,
        tradelines=tradelines,
        subscribers=subscribers,
        file_type=doc.file_type,
        ocr_used=doc.ocr_used,
        extraction_quality=quality,
    )


def _valid_bureaus(codes: list) -> list[BureauCode]:
    return [b for b in codes if b in ("TUC", "EXP", "EQF")]


def _finalize_report(
    report: ParsedReport, agent_health: dict | None = None, *, file_name: str = ""
) -> ParsedReport:
    from app.services.bureau_coverage import apply_bureau_coverage

    report.credit_health = build_health_summary(report, agent_health)
    report = apply_high_priority_selection(report)
    report.credit_intelligence = build_credit_intelligence(report)
    report = apply_bureau_coverage(report, file_name=file_name)
    return report


def _apply_fallback(doc: ExtractedDocument, reason: str) -> ParsedReport:
    report = parse_document_fallback(doc)
    report.source = "fallback_parser"
    if not report.analysis_summary:
        report.analysis_summary = f"Parsed locally (agent unavailable: {reason})"
    for tl in report.tradelines:
        if not tl.dispute_bureaus:
            tl.dispute_bureaus = list(tl.bureaus)
        if not tl.suggested_dispute_reason and not tl.dispute_reason:
            tl.suggested_dispute_reason = "Account information is inaccurate or unverifiable."
            tl.dispute_reason = tl.suggested_dispute_reason
        if not tl.analysis_notes:
            tl.analysis_notes = f"Status: {tl.status}; Balance: {tl.balance}"
    return report
