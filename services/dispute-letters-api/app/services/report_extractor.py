from __future__ import annotations

import re

from app.models import ConsumerInfo, ParsedReport
from app.services.bureau_text_parser import parse_bureau_text


def extract_from_text(
    text: str,
    file_type: str,
    ocr_used: bool,
    quality: str,
    file_name: str = "",
) -> ParsedReport:
    """Local extraction only. Report analysis decides when the Cursor agent runs."""
    parsed = parse_bureau_text(
        text,
        file_type=file_type,
        ocr_used=ocr_used,
        quality=quality,
        file_name=file_name,
    )
    if parsed is not None and parsed.tradelines:
        return parsed
    return _extract_heuristic(text, file_type, ocr_used, quality)


def _extract_heuristic(text: str, file_type: str, ocr_used: bool, quality: str) -> ParsedReport:
    """Name-only fallback when no labeled accounts are present."""
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
