from __future__ import annotations

import json
import os
import re
import uuid

from app.config import PROJECT_ROOT
from app.models import ConsumerInfo, ParsedReport, Subscriber, Tradeline

EXTRACT_PROMPT = """You are extracting structured data from a credit report text.

Read ONLY what is present in the text. Do NOT invent accounts or data.

Return ONLY valid JSON matching this schema:
{
  "consumer": {"name": "", "dob": "", "ssn_last4": "", "addresses": []},
  "tradelines": [
    {
      "creditor": "",
      "account_tu": "",
      "account_exp": "",
      "account_eqf": "",
      "account_type": "",
      "status": "",
      "balance": "",
      "past_due": "",
      "remarks": "",
      "bureaus": ["TUC"|"EXP"|"EQF"]
    }
  ],
  "subscribers": [{"name": "", "address_lines": [], "phone": ""}]
}

Credit report text:
---
{text}
---
"""


def extract_from_text(
    text: str,
    file_type: str,
    ocr_used: bool,
    quality: str,
) -> ParsedReport:
    api_key = os.environ.get("CURSOR_API_KEY", "").strip()
    if api_key and len(text.strip()) > 100:
        try:
            return _extract_via_sdk(text, file_type, ocr_used, quality, api_key)
        except Exception:
            pass
    return _extract_heuristic(text, file_type, ocr_used, quality)


def _extract_via_sdk(text: str, file_type: str, ocr_used: bool, quality: str, api_key: str) -> ParsedReport:
    from app.services.cursor_client import agent_prompt_blocking, result_text

    clipped = text[:120000]
    result = agent_prompt_blocking(EXTRACT_PROMPT.format(text=clipped))
    raw = result_text(result)
    data = _parse_json_from_response(raw)
    return _dict_to_report(data, file_type, ocr_used, quality, source="ai_extract")


def _result_text(result) -> str:
    if hasattr(result, "result") and result.result:
        return str(result.result)
    if hasattr(result, "status"):
        return str(result)
    return str(result)


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


def _dict_to_report(data: dict, file_type: str, ocr_used: bool, quality: str, source: str) -> ParsedReport:
    consumer_data = data.get("consumer") or {}
    consumer = ConsumerInfo(
        name=consumer_data.get("name", ""),
        dob=consumer_data.get("dob", ""),
        ssn_last4=consumer_data.get("ssn_last4", ""),
        addresses=consumer_data.get("addresses") or [],
    )
    tradelines: list[Tradeline] = []
    for item in data.get("tradelines") or []:
        bureaus = [b for b in (item.get("bureaus") or []) if b in ("TUC", "EXP", "EQF")]
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
                bureaus=bureaus,
                is_collection="collection" in (item.get("account_type") or "").lower(),
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
    return ParsedReport(
        source=source,
        consumer=consumer,
        tradelines=tradelines,
        subscribers=subscribers,
        file_type=file_type,
        ocr_used=ocr_used,
        extraction_quality=quality,
    )


def _extract_heuristic(text: str, file_type: str, ocr_used: bool, quality: str) -> ParsedReport:
    """Minimal fallback when SDK unavailable — surfaces text for manual tradeline entry."""
    consumer = ConsumerInfo()
    name_match = re.search(r"(?:Name|Consumer)[:\s]+([A-Za-z ,.'-]+)", text, re.I)
    if name_match:
        raw_name = name_match.group(1).strip()
        # OCR often repeats the name; keep the first distinct segment.
        parts = [p.strip() for p in re.split(r"\s{2,}|\n", raw_name) if p.strip()]
        consumer.name = parts[0][:80] if parts else raw_name[:80]
    return ParsedReport(
        source="heuristic",
        consumer=consumer,
        tradelines=[],
        subscribers=[],
        file_type=file_type,
        ocr_used=ocr_used,
        extraction_quality="low" if quality == "low" else quality,
    )
