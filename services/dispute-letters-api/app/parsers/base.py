from __future__ import annotations

from app.models import ExtractedDocument, ParsedReport
from app.parsers import identityiq, smartcredit
from app.services import report_extractor


def parse_document_fallback(doc: ExtractedDocument) -> ParsedReport:
    """Fallback parsers when Cursor agent analysis is unavailable."""
    if doc.html:
        if identityiq.can_parse(doc.html):
            report = identityiq.parse(doc.html, doc.file_type, doc.ocr_used, doc.extraction_quality)
            report.source = "fallback_parser"
            _enrich_tradelines_from_fallback(report)
            return report
        if smartcredit.can_parse(doc.html):
            try:
                report = smartcredit.parse(doc.html, doc.file_type, doc.ocr_used, doc.extraction_quality)
                report.source = "fallback_parser"
                _enrich_tradelines_from_fallback(report)
                return report
            except NotImplementedError:
                pass
    report = report_extractor.extract_from_text(
        doc.text, doc.file_type, doc.ocr_used, doc.extraction_quality
    )
    report.source = "fallback_parser"
    _enrich_tradelines_from_fallback(report)
    return report


def _enrich_tradelines_from_fallback(report: ParsedReport) -> None:
    for tl in report.tradelines:
        if not tl.dispute_bureaus:
            tl.dispute_bureaus = list(tl.bureaus)
        if not tl.suggested_dispute_reason:
            tl.suggested_dispute_reason = "Account information is inaccurate or unverifiable."
        if not tl.dispute_reason:
            tl.dispute_reason = tl.suggested_dispute_reason
