"""Unit smoke tests for Credit Intelligence helpers."""

from __future__ import annotations

from app.models import AccountOutcome, ConsumerInfo, ParsedReport, Tradeline
from app.services.credit_intelligence import build_credit_intelligence
from app.services.money_parse import parse_money


def _tl(**kwargs) -> Tradeline:
    base = dict(
        id=kwargs.pop("id", "t1"),
        creditor=kwargs.pop("creditor", "Test Bank"),
        account_type=kwargs.pop("account_type", "Credit Card"),
        status=kwargs.pop("status", "Open"),
        balance=kwargs.pop("balance", "$2,000"),
        credit_limit=kwargs.pop("credit_limit", "$10,000"),
        date_opened=kwargs.pop("date_opened", "01/15/2018"),
        bureaus=kwargs.pop("bureaus", ["TUC", "EXP"]),
    )
    base.update(kwargs)
    return Tradeline(**base)


def test_parse_money_basic():
    assert parse_money("$1,234.50") == 1234.5
    assert parse_money("0") == 0.0
    assert parse_money("n/a") is None


def test_intelligence_utilization_and_recommendations():
    report = ParsedReport(
        consumer=ConsumerInfo(name="Jane Doe"),
        report_date="07/01/2026",
        tradelines=[
            _tl(id="r1", balance="$8,000", credit_limit="$10,000"),
            _tl(
                id="c1",
                creditor="ABC Collections",
                account_type="Collection",
                status="Open Collection",
                is_collection=True,
                balance="$450",
                date_of_first_delinquency="03/01/2016",
            ),
            _tl(
                id="i1",
                creditor="Hard Inquiry Bank",
                account_type="Hard Inquiry",
                status="Inquiry",
                balance="",
                credit_limit="",
                date_opened="05/01/2026",
            ),
        ],
    )
    report.credit_health.scores.tuc = 620
    intel = build_credit_intelligence(report)
    assert intel.overall.band in ("fair", "good", "poor", "very_good", "exceptional", "unscored")
    util = next(f for f in intel.factors if f.factor == "revolving_utilization")
    assert util.metrics.get("aggregate_utilization") is not None
    assert util.metrics["aggregate_utilization"] >= 0.7
    assert any(r.category == "utilization" for r in intel.recommendations)
    assert any(r.category == "dispute" for r in intel.recommendations)
    assert intel.funding_readiness.score_0_to_100 >= 5
    assert intel.funding_readiness.adjustments
    points = sum(item.points for item in intel.funding_readiness.adjustments)
    assert intel.funding_readiness.score_0_to_100 == max(5, min(95, 55 + points))
    assert intel.version == "1.1"
    dispute_ids = [
        tid
        for rec in intel.recommendations
        if rec.category == "dispute"
        for tid in rec.related_tradeline_ids
    ]
    assert dispute_ids.count("c1") == 1
    assert intel.disclaimer


def _report(report_date: str, tradelines: list[Tradeline], **scores: int) -> ParsedReport:
    report = ParsedReport(
        consumer=ConsumerInfo(name="Jane Doe"),
        report_date=report_date,
        tradelines=tradelines,
    )
    for bureau, score in scores.items():
        setattr(report.credit_health.scores, bureau, score)
    return report


def test_open_card_times_late_is_a_payment_finding():
    report = _report(
        "07/01/2026",
        [
            _tl(
                id="card",
                status="Open",
                payment_history="Times late 30/60/90: 1/0/0; EQF:30:2020-01;EXP:OK;TUC:OK",
            )
        ],
    )
    intel = build_credit_intelligence(report)
    payment = next(f for f in intel.factors if f.factor == "payment_history")
    finding = next(item for item in payment.findings if item["tradeline_id"] == "card")
    assert finding["late_30"] == 1
    assert finding["late_60"] == 0
    assert finding["late_90"] == 0
    assert finding["severity"] == "moderate"
    assert finding["age_months"] is not None


def test_collection_without_dofd_is_not_obsolete():
    report = _report(
        "07/01/2026",
        [
            _tl(
                id="old-open",
                creditor="ABC Collections",
                account_type="Collection",
                status="Open Collection",
                is_collection=True,
                balance="$450",
                credit_limit="",
                date_opened="01/15/2010",
                date_of_first_delinquency="",
            )
        ],
    )
    intel = build_credit_intelligence(report)
    collections = next(f for f in intel.factors if f.factor == "collections")
    finding = collections.findings[0]
    assert finding["possibly_obsolete"] is False
    assert finding["date_missing"] is True
    assert "missing" in finding["strategy"].lower()
    insight = next(item for item in intel.account_dispute_insights if item["tradeline_id"] == "old-open")
    assert "missing" in insight["rationale"].lower()


def test_balance_without_limit_is_excluded_from_utilization():
    report = _report(
        "07/01/2026",
        [
            _tl(id="complete", balance="$1,000", credit_limit="$5,000"),
            _tl(id="nolimit", creditor="Store Card", balance="$4,000", credit_limit=""),
        ],
    )
    intel = build_credit_intelligence(report)
    util = next(f for f in intel.factors if f.factor == "revolving_utilization")
    assert util.metrics["aggregate_utilization"] == 0.2
    assert util.metrics["missing_limits"] == 1
    assert util.metrics["excluded_balance"] == 4000


def test_deleted_outcome_drops_the_account_from_dispute_recommendations():
    report = _report(
        "07/01/2026",
        [
            _tl(
                id="gone",
                creditor="ABC Collections",
                account_type="Collection",
                status="Open Collection",
                is_collection=True,
                account_tu="****1234",
                balance="$450",
                credit_limit="",
                date_of_first_delinquency="03/01/2016",
            ),
            _tl(
                id="still",
                creditor="XYZ Collections",
                account_type="Collection",
                status="Open Collection",
                is_collection=True,
                account_tu="****5678",
                balance="$200",
                credit_limit="",
                date_of_first_delinquency="01/01/2024",
            ),
        ],
    )
    intel = build_credit_intelligence(
        report,
        outcomes=[
            AccountOutcome(creditor="ABC Collections", account_last4="1234", status="deleted"),
            AccountOutcome(creditor="XYZ Collections", account_last4="5678", status="verified"),
        ],
    )
    dispute_ids = [
        tid
        for rec in intel.recommendations
        if rec.category == "dispute"
        for tid in rec.related_tradeline_ids
    ]
    assert "gone" not in dispute_ids
    assert dispute_ids.count("still") == 1
    gone = next(item for item in intel.account_dispute_insights if item["tradeline_id"] == "gone")
    still = next(item for item in intel.account_dispute_insights if item["tradeline_id"] == "still")
    assert gone["dispute_recommended"] is False
    assert still["dispute_recommended"] is True
    assert "later round" in still["rationale"].lower()

    fresh = build_credit_intelligence(report)
    fresh_ids = [
        tid
        for rec in fresh.recommendations
        if rec.category == "dispute"
        for tid in rec.related_tradeline_ids
    ]
    assert "gone" in fresh_ids
    assert "still" in fresh_ids


def test_high_score_with_fresh_collection_splits_band_and_file_risk():
    report = _report(
        "07/01/2026",
        [
            _tl(id="card", balance="$500", credit_limit="$10,000"),
            _tl(
                id="fresh",
                creditor="New Collections",
                account_type="Collection",
                status="Open Collection",
                is_collection=True,
                balance="$300",
                credit_limit="",
                date_of_first_delinquency="02/01/2026",
            ),
        ],
        tuc=780,
        exp=790,
        eqf=800,
    )
    intel = build_credit_intelligence(report)
    assert intel.overall.band in ("good", "very_good", "exceptional")
    assert intel.overall.file_risk_band == "high"
    assert "file risk" in intel.overall.narrative.lower()


if __name__ == "__main__":
    test_parse_money_basic()
    test_intelligence_utilization_and_recommendations()
    test_open_card_times_late_is_a_payment_finding()
    test_collection_without_dofd_is_not_obsolete()
    test_balance_without_limit_is_excluded_from_utilization()
    test_deleted_outcome_drops_the_account_from_dispute_recommendations()
    test_high_score_with_fresh_collection_splits_band_and_file_risk()
    print("credit_intelligence smoke tests passed")
