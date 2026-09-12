"""Re-enrich tradelines and recompute health / bureau coverage from the current report."""

from __future__ import annotations

from datetime import date

from app.models import ParsedReport
from app.services.bureau_coverage import apply_bureau_coverage
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
