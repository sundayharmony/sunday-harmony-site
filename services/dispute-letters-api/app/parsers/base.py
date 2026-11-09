from __future__ import annotations

from app.models import ExtractedDocument, ParsedReport
from app.parsers import identityiq, smartcredit
from app.services import report_extractor


def parse_document_fallback(doc: ExtractedDocument, file_name: str = "") -> ParsedReport:
    """Local parsers. Does not call the Cursor agent."""
    if doc.html:
        if identityiq.can_parse(doc.html):
            report = identityiq.parse(doc.html, doc.file_type, doc.ocr_used, doc.extraction_quality)
            report.source = "fallback_parser"
            _enrich_tradelines_from_fallback(report)
            return report
        if smartcredit.can_parse(doc.html):
            report = smartcredit.parse(doc.html, doc.file_type, doc.ocr_used, doc.extraction_quality)
            report.source = "fallback_parser"
            _enrich_tradelines_from_fallback(report)
            return report
    text_blob = doc.text or ""
    if smartcredit.can_parse_text(text_blob, file_name) or smartcredit.can_parse(file_name):
        report = smartcredit.parse_text(
            text_blob,
            file_type=doc.file_type,
            ocr_used=doc.ocr_used,
            quality=doc.extraction_quality,
            file_name=file_name,
        )
        if report.tradelines:
            report.source = "fallback_parser"
            _enrich_tradelines_from_fallback(report)
            return report
    report = report_extractor.extract_from_text(
        doc.text,
        doc.file_type,
        doc.ocr_used,
        doc.extraction_quality,
        file_name=file_name,
    )
    report.source = "fallback_parser"
    _enrich_tradelines_from_fallback(report)
    return report


def _enrich_tradelines_from_fallback(report: ParsedReport) -> None:
    for tl in report.tradelines:
        if not tl.dispute_bureaus:
            tl.dispute_bureaus = list(tl.bureaus)
        if tl.suggested_dispute_reason and not tl.dispute_reason:
            tl.dispute_reason = tl.suggested_dispute_reason
