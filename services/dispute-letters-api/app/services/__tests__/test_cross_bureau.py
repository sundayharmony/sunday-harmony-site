import json
from pathlib import Path

from app.models import Tradeline
from app.services.cross_bureau import (
    FLAG_CONSISTENT,
    FLAG_INCONSISTENT,
    apply_cross_bureau_enrichment,
    classify_mismatch_kind,
    select_for_round,
)
from app.services.credit_health import enrich_tradeline, removal_sort_key
from app.services.letter_router import MAX_ITEMS_PER_LETTER, build_plan
from app.models import DisputePlanRequest, ParsedReport, TradelineSelection

FIXTURES = json.loads(
    (Path(__file__).parent / "fixtures" / "cross_bureau_cases.json").read_text(encoding="utf-8")
)


def _tl(data: dict) -> Tradeline:
    return Tradeline(
        id=data["id"],
        creditor=data["creditor"],
        account_tu=data.get("account_tu", ""),
        account_exp=data.get("account_exp", ""),
        account_eqf=data.get("account_eqf", ""),
        status=data.get("status", ""),
        bureaus=data.get("bureaus", []),
        payment_history=data.get("payment_history", ""),
    )


def test_fixture_classification():
    for key, data in FIXTURES.items():
        kind, summary = classify_mismatch_kind(_tl(data))
        assert kind == data["expect_kind"], f"{key}: {kind} summary={summary}"


def test_absent_reporting_is_not_inconsistency():
    kind, _ = classify_mismatch_kind(_tl(FIXTURES["C_single_bureau_not_mismatch"]))
    assert kind == "other"


def test_enrich_sets_flags_and_reasons():
    tl = enrich_tradeline(_tl(FIXTURES["A_inconsistent_late"]))
    assert FLAG_INCONSISTENT in tl.legal_flags
    assert "inconsistent" in (tl.suggested_dispute_reason or "").lower()
    assert tl.mismatch_summary


def test_round1_sort_prefers_inconsistent():
    items = [
        enrich_tradeline(_tl(FIXTURES["B_consistent_late"])),
        enrich_tradeline(_tl(FIXTURES["A_inconsistent_late"])),
        enrich_tradeline(_tl(FIXTURES["C_single_bureau_not_mismatch"])),
    ]
    ordered = sorted(items, key=removal_sort_key)
    assert ordered[0].id == "fix-a-coast"
    assert FLAG_INCONSISTENT in ordered[0].legal_flags


def test_select_for_round2_prefers_consistent():
    items = [_tl(FIXTURES["A_inconsistent_late"]), _tl(FIXTURES["B_consistent_late"])]
    r2 = select_for_round(items, round_number=2, max_items=7)
    assert all(FLAG_CONSISTENT in (tl.legal_flags or []) for tl in r2)
    assert all(FLAG_INCONSISTENT not in (tl.legal_flags or []) for tl in r2)


def test_round1_plans_all_three_bureaus_max_seven():
    assert MAX_ITEMS_PER_LETTER == 7
    tradelines = []
    for i in range(8):
        tradelines.append(
            enrich_tradeline(
                Tradeline(
                    id=f"inc-{i}",
                    creditor=f"BANK{i}",
                    account_tu=f"****{1000+i}",
                    account_exp=f"****{1000+i}",
                    account_eqf=f"****{1000+i}",
                    status="Open",
                    bureaus=["EQF", "EXP", "TUC"],
                    payment_history=f"EQF:30:2020-0{(i%8)+1};EXP:OK;TUC:OK",
                    selected=True,
                )
            )
        )
    report = ParsedReport(tradelines=tradelines)
    resp = build_plan(
        "sess-test",
        report,
        DisputePlanRequest(
            session_id="sess-test",
            selections=[TradelineSelection(id=tl.id, selected=True) for tl in tradelines],
            round_number=1,
        ),
    )
    bureau_types = {p.letter_type for p in resp.plans if p.letter_type.startswith("bureau_")}
    assert bureau_types == {"bureau_equifax", "bureau_experian", "bureau_transunion"}
    for plan in resp.plans:
        if plan.letter_type.startswith("bureau_"):
            assert 1 <= len(plan.items) <= 7


def test_staff_override_flag():
    tl = _tl(FIXTURES["C_single_bureau_not_mismatch"])
    tl.legal_flags = [FLAG_INCONSISTENT]
    tl.mismatch_summary = "Staff confirmed month conflict on re-pull"
    enriched = apply_cross_bureau_enrichment(tl)
    kind, summary = classify_mismatch_kind(enriched)
    assert kind == "cross_bureau_inconsistent"
    assert "Staff confirmed" in summary
