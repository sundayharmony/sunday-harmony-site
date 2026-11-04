"""Recommended-dispute selection and health refresh."""

from __future__ import annotations

from app.models import BureauScores, ConsumerInfo, CreditHealthSummary, ParsedReport, Tradeline
from app.services.credit_health import (
    apply_high_priority_selection,
    is_recommended_dispute,
)
from app.services.report_refresh import (
    needs_score_recovery,
    recover_scores_from_storage,
    refresh_report_health,
)


def _tl(**kwargs) -> Tradeline:
    base = dict(
        id=kwargs.pop("id", "t1"),
        creditor=kwargs.pop("creditor", "Test Bank"),
        status=kwargs.pop("status", "Open"),
        bureaus=kwargs.pop("bureaus", ["EXP"]),
    )
    base.update(kwargs)
    return Tradeline(**base)


def test_needs_score_recovery_skips_credit_hero_with_all_scores():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        credit_health=CreditHealthSummary(scores=BureauScores(tuc=493, exp=501, eqf=488)),
    )
    assert needs_score_recovery(report, "Jamal George Credit Hero.pdf") is False


def test_needs_score_recovery_credit_hero_when_any_bureau_missing():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        credit_health=CreditHealthSummary(scores=BureauScores(tuc=493, exp=501, eqf=None)),
    )
    assert needs_score_recovery(report, "Jamal George Credit Hero.pdf") is True


def test_recover_returns_early_when_credit_hero_scores_complete():
    """Must not reach storage download — storage_path is intentionally invalid."""
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        credit_health=CreditHealthSummary(scores=BureauScores(tuc=493, exp=501, eqf=488)),
    )
    recover_scores_from_storage(
        report,
        {
            "file_name": "Jamal George Credit Hero.pdf",
            "storage_path": "sessions/abc/Jamal George Credit Hero.pdf",
        },
    )
    assert report.credit_health.scores.tuc == 493
    assert report.credit_health.scores.exp == 501
    assert report.credit_health.scores.eqf == 488


def test_recommended_includes_medium_and_clean_profile():
    collection = _tl(id="c", is_collection=True, status="Collection", repair_priority="high")
    late = _tl(id="l", remarks="30 days late", repair_priority="medium")
    inquiry = _tl(id="i", status="Inquiry", item_category="inquiry", repair_priority="low")
    assert is_recommended_dispute(collection) is True
    assert is_recommended_dispute(late) is True
    assert is_recommended_dispute(inquiry) is False


def test_apply_high_priority_selects_recommended_when_none_selected():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        tradelines=[
            _tl(id="c", is_collection=True, status="Collection", repair_priority="high"),
            _tl(id="i", status="Inquiry", item_category="inquiry", repair_priority="low"),
            _tl(id="late", remarks="30 days late", repair_priority="medium"),
        ],
    )
    apply_high_priority_selection(report)
    selected = {tl.id for tl in report.tradelines if tl.selected}
    assert selected == {"c", "late"}


def test_apply_high_priority_keeps_existing_inquiry_selection():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        tradelines=[
            _tl(id="i", status="Inquiry", item_category="inquiry", repair_priority="low", selected=True),
            _tl(id="c", is_collection=True, status="Collection", repair_priority="high", selected=False),
        ],
    )
    apply_high_priority_selection(report)
    assert report.tradelines[0].selected is True
    assert report.tradelines[1].selected is False


def test_refresh_report_health_recomputes_stale_counts():
    report = ParsedReport(
        consumer=ConsumerInfo(name="A"),
        credit_health=CreditHealthSummary(negative_count=99, total_accounts=1),
        tradelines=[
            _tl(id="open", status="Open", remarks="never late", account_exp="1111"),
            _tl(id="coll", is_collection=True, status="Collection", account_exp="2222"),
        ],
    )
    report.credit_health.scores.exp = 640
    refresh_report_health(report, "experian.pdf")
    assert report.credit_health.negative_count == 1
    assert report.credit_health.collection_count == 1
    assert report.credit_health.scores.exp == 640
    assert report.bureau_coverage is not None
    assert "EXP" in report.credit_health.per_bureau
    assert report.credit_health.per_bureau["EXP"].negative_count == 1
