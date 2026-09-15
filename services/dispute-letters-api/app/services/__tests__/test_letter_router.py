"""Selected inquiries must appear in bureau letters even without a typed reason."""

from __future__ import annotations

from app.models import ConsumerInfo, DisputePlanRequest, ParsedReport, Tradeline, TradelineSelection
from app.services.letter_router import build_plan


def test_selected_inquiry_with_empty_reason_is_in_experian_letter():
    inquiry = Tradeline(
        id="td-bank",
        creditor="TD BANK N.A.",
        account_exp="—",
        account_type="Inquiry",
        status="Inquiry",
        bureaus=["EXP"],
        dispute_bureaus=["EXP"],
        item_category="inquiry",
        selected=True,
        dispute_reason="",
        suggested_dispute_reason="",
        dispute_furnisher=False,
        analysis_notes="Recent bank inquiry; part of inquiry cluster during credit-seeking period.",
    )
    collection = Tradeline(
        id="verizon",
        creditor="VERIZON WIRELESS",
        account_exp="327445XXXXXXXX",
        status="Collection",
        is_collection=True,
        bureaus=["EXP"],
        dispute_bureaus=["EXP"],
        item_category="collection",
        selected=True,
        dispute_reason="Request complete deletion of this closed collection tradeline.",
        dispute_furnisher=False,
    )
    report = ParsedReport(
        consumer=ConsumerInfo(name="Test Client"),
        tradelines=[inquiry, collection],
    )
    request = DisputePlanRequest(
        session_id="s1",
        selections=[
            TradelineSelection(id="td-bank", selected=True, dispute_reason=""),
            TradelineSelection(id="verizon", selected=True, dispute_reason=collection.dispute_reason),
        ],
    )
    result = build_plan("s1", report, request)
    experian = next(p for p in result.plans if p.letter_type == "bureau_experian")
    creditors = [item.creditor for item in experian.items]
    assert "TD BANK N.A." in creditors
    assert "VERIZON WIRELESS" in creditors
    td = next(item for item in experian.items if item.creditor == "TD BANK N.A.")
    assert "§604" in td.dispute_reason
    assert "1681b" in td.dispute_reason


def _exp_tradeline(tid: str, creditor: str) -> Tradeline:
    return Tradeline(
        id=tid,
        creditor=creditor,
        account_exp="1111",
        account_type="Credit Card",
        status="Open",
        bureaus=["EXP"],
        dispute_bureaus=["EXP"],
        selected=True,
        dispute_reason="Request deletion of inaccurate reporting.",
    )


def test_round1_disputed_status_keeps_grouped_bureau_letters():
    """Lifecycle stamps items as disputed at plan time; Round 1 must stay 1 letter per bureau."""
    one = _exp_tradeline("one", "CAPITAL ONE")
    two = _exp_tradeline("two", "DISCOVER")
    report = ParsedReport(consumer=ConsumerInfo(name="Test Client"), tradelines=[one, two])
    request = DisputePlanRequest(
        session_id="s1",
        round_number=1,
        selections=[
            TradelineSelection(id="one", selected=True, item_status="disputed"),
            TradelineSelection(id="two", selected=True, item_status="selected_for_round"),
        ],
    )
    result = build_plan("s1", report, request)
    experian = [p for p in result.plans if p.letter_type == "bureau_experian"]
    assert len(experian) == 1
    creditors = {item.creditor for item in experian[0].items}
    assert creditors == {"CAPITAL ONE", "DISCOVER"}
    assert not any(p.letter_type == "method_of_verification" for p in result.plans)


def test_round2_verified_routes_to_method_of_verification():
    tl = _exp_tradeline("one", "CAPITAL ONE")
    report = ParsedReport(consumer=ConsumerInfo(name="Test Client"), tradelines=[tl])
    request = DisputePlanRequest(
        session_id="s1",
        round_number=2,
        selections=[TradelineSelection(id="one", selected=True, item_status="verified")],
    )
    result = build_plan("s1", report, request)
    assert [p.letter_type for p in result.plans] == ["method_of_verification"]
    assert result.plans[0].items[0].creditor == "CAPITAL ONE"


def test_round2_no_response_routes_to_warning():
    tl = _exp_tradeline("one", "CAPITAL ONE")
    report = ParsedReport(consumer=ConsumerInfo(name="Test Client"), tradelines=[tl])
    request = DisputePlanRequest(
        session_id="s1",
        round_number=2,
        selections=[TradelineSelection(id="one", selected=True, item_status="no_response")],
    )
    result = build_plan("s1", report, request)
    assert [p.letter_type for p in result.plans] == ["warning_intent"]


if __name__ == "__main__":
    test_selected_inquiry_with_empty_reason_is_in_experian_letter()
    test_round1_disputed_status_keeps_grouped_bureau_letters()
    test_round2_verified_routes_to_method_of_verification()
    test_round2_no_response_routes_to_warning()
    print("letter_router tests passed")
