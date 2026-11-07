"""plan-from-report live-test hook without loading the FastAPI app.

CI installs only requirements-test.txt (no fastapi/supabase). Exercise the same
enrich → build_plan path the endpoint uses, and assert the route stays
secret-gated in source.
"""

from __future__ import annotations

from pathlib import Path

from app.models import DisputePlanFromReportRequest, DisputePlanRequest, ParsedReport, Tradeline, TradelineSelection
from app.services.credit_health import enrich_tradeline
from app.services.letter_router import build_plan


def _synthetic_inconsistent() -> Tradeline:
    return Tradeline(
        id="tl-a",
        creditor="BANK",
        account_tu="****1111",
        account_exp="****1111",
        account_eqf="****1111",
        status="Open",
        bureaus=["EQF", "EXP", "TUC"],
        payment_history="EQF:30:2020-01;EXP:OK;TUC:OK",
        selected=True,
    )


def test_plan_from_report_enrich_then_round1_inconsistency():
    """Mirrors dispute_plan_from_report: enrich inline report, then build_plan."""
    body = DisputePlanFromReportRequest(
        session_id="inline-live",
        round_number=1,
        report=ParsedReport(tradelines=[_synthetic_inconsistent()]),
        selections=[TradelineSelection(id="tl-a", selected=True)],
    )
    enriched = body.report.model_copy(deep=True)
    enriched.tradelines = [enrich_tradeline(tl) for tl in enriched.tradelines]
    request = DisputePlanRequest(
        session_id=body.session_id,
        selections=body.selections,
        furnisher_address_overrides=body.furnisher_address_overrides,
        round_number=body.round_number,
        force_one_item_per_bureau=body.force_one_item_per_bureau,
    )
    data = build_plan(body.session_id, enriched, request)
    assert data.session_id == "inline-live"
    bureau_types = {p.letter_type for p in data.plans if p.letter_type.startswith("bureau_")}
    assert bureau_types == {"bureau_equifax", "bureau_experian", "bureau_transunion"}
    reasons = [
        item.dispute_reason.lower()
        for p in data.plans
        if p.letter_type.startswith("bureau_")
        for item in p.items
    ]
    assert reasons
    assert all("inconsistent" in r for r in reasons)


def test_plan_from_report_route_remains_secret_gated():
    main_src = (Path(__file__).resolve().parents[2] / "main.py").read_text(encoding="utf-8")
    assert '@app.post("/internal/disputes/plan-from-report"' in main_src
    assert "def dispute_plan_from_report(" in main_src
    assert "verify_internal_secret" in main_src
    # Endpoint must depend on the same Bearer gate as other /internal routes.
    gate_idx = main_src.index("def dispute_plan_from_report(")
    snippet = main_src[gate_idx : gate_idx + 400]
    assert "Depends(verify_internal_secret)" in snippet
