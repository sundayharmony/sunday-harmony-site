"""Re-enrich tradelines and recompute health / bureau coverage from the current report."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from app.models import ParsedReport
from app.services.bureau_coverage import apply_bureau_coverage
from app.services.bureau_scores import fill_missing_scores, scores_missing
from app.services.credit_health import build_health_summary
from app.services.credit_intelligence import build_account_dispute_insights
from app.services.money_parse import parse_date


def refresh_report_health(report: ParsedReport, file_name: str = "") -> ParsedReport:
    """Re-run enrich + health summary + per-bureau counts; refresh dispute insights if present."""
    report.credit_health = build_health_summary(report)
    apply_bureau_coverage(report, file_name)
    intel = report.credit_intelligence
    if intel is not None:
        as_of = parse_date(report.report_date) or date.today()
        intel.account_dispute_insights = build_account_dispute_insights(report.tradelines, as_of)
        report.credit_intelligence = intel
    return report


def recover_scores_from_storage(report: ParsedReport, row: dict | None) -> ParsedReport:
    """Re-read bureau scores from the stored upload when report_json is missing them."""
    if not scores_missing(report.credit_health.scores):
        return report
    if not row:
        return report
    storage_path = str(row.get("storage_path") or "")
    file_name = str(row.get("file_name") or storage_path)
    suffix = Path(file_name).suffix.lower() or Path(storage_path).suffix.lower()
    if suffix not in {".html", ".htm", ".txt", ".pdf"}:
        return report
    try:
        if suffix == ".pdf":
            from app.ingest.pdf import extract_pdf
            from app.storage import write_temp_report

            tmp = write_temp_report(storage_path, suffix)
            try:
                doc = extract_pdf(tmp)
                text = doc.text or ""
            finally:
                tmp.unlink(missing_ok=True)
            html = ""
        else:
            from app.storage import download_storage_bytes

            raw = download_storage_bytes(storage_path)
            text = raw.decode("utf-8", errors="ignore") if isinstance(raw, (bytes, bytearray)) else str(raw)
            html = text if suffix in {".html", ".htm"} else ""
    except Exception:
        return report
    fill_missing_scores(report, html=html, text=text, file_name=file_name)
    return report
