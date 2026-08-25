"""Unit tests for bureau coverage detection."""

from __future__ import annotations

from app.models import ConsumerInfo, ParsedReport, Tradeline
from app.services.bureau_coverage import (
    apply_bureau_coverage,
    bureau_health_counts,
    detect_bureau_coverage,
)
from app.services.credit_health import build_health_summary


def _tl(**kwargs) -> Tradeline:
    base = dict(
        id=kwargs.pop("id", "t1"),
        creditor=kwargs.pop("creditor", "Test Bank"),
        account_type=kwargs.pop("account_type", "Credit Card"),
        status=kwargs.pop("status", "Open"),
        balance=kwargs.pop("balance", "$2,000"),
        bureaus=kwargs.pop("bureaus", []),
    )
    base.update(kwargs)
    return Tradeline(**base)


def test_detect_score_only_experian():
    report = ParsedReport(consumer=ConsumerInfo(name="A"), tradelines=[])
    report.credit_health.scores.exp = 640
    cov = detect_bureau_coverage(report, "")
    assert cov.bureaus == ["EXP"]
    assert cov.coverage == "single"
    assert cov.confidence == "high"


def test_detect_tri_merge_scores():
    report = ParsedReport(consumer=ConsumerInfo(name="A"), tradelines=[])
    report.credit_health.scores.tuc = 600
    report.credit_health.scores.exp = 610
    report.credit_health.scores.eqf = 620
    cov = detect_bureau_coverage(report, "report.pdf")
    assert cov.bureaus == ["TUC", "EXP", "EQF"]
    assert cov.coverage == "tri_merge"
    assert cov.confidence == "high"


def test_filename_fallback():
    report = ParsedReport(consumer=ConsumerInfo(name="A"), tradelines=[])
    cov = detect_bureau_coverage(report, "Juan_Experian_Aug.pdf")
    assert cov.bureaus == ["EXP"]
    assert cov.coverage == "single"


def test_credit_hero_filename_tri_merge():
    report = ParsedReport(consumer=ConsumerInfo(name="A"), tradelines=[])
    cov = detect_bureau_coverage(report, "Juan Pagan Credit Hero 8-21-2026.pdf")
    assert set(cov.bureaus) == {"TUC", "EXP", "EQF"}
    assert cov.coverage == "tri_merge"


def test_per_bureau_negative_counts():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        tradelines=[
            _tl(id="e1", bureaus=["EXP"], is_collection=True, status="Collection"),
            _tl(id="t1", bureaus=["TUC"], status="Open", is_collection=False),
            _tl(id="both", bureaus=["EXP", "TUC"], status="Charge Off", balance="$100"),
        ],
    )
    build_health_summary(report)
    exp = bureau_health_counts(report, "EXP")
    tuc = bureau_health_counts(report, "TUC")
    assert exp.total_accounts == 2
    assert exp.collection_count == 1
    assert tuc.total_accounts == 2
    assert tuc.collection_count == 0


def test_apply_bureau_coverage_persists():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        tradelines=[_tl(id="e1", bureaus=["EXP"], account_exp="****1234")],
    )
    report.credit_health.scores.exp = 700
    apply_bureau_coverage(report, "experian.pdf")
    assert report.bureau_coverage is not None
    assert report.bureau_coverage.bureaus == ["EXP"]
    assert "EXP" in report.credit_health.per_bureau
    assert report.credit_health.per_bureau["EXP"].total_accounts == 1


if __name__ == "__main__":
    test_detect_score_only_experian()
    test_detect_tri_merge_scores()
    test_filename_fallback()
    test_credit_hero_filename_tri_merge()
    test_per_bureau_negative_counts()
    test_apply_bureau_coverage_persists()
    print("bureau_coverage tests passed")
