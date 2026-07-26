"""Unit smoke tests for Credit Intelligence helpers."""

from __future__ import annotations

from app.models import ConsumerInfo, ParsedReport, Tradeline
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
    assert intel.disclaimer


if __name__ == "__main__":
    test_parse_money_basic()
    test_intelligence_utilization_and_recommendations()
    print("credit_intelligence smoke tests passed")
