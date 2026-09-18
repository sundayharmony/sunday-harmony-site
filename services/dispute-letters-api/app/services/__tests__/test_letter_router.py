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


def _account_from_id(tid: str) -> str:
    digits = "".join(ch for ch in tid if ch.isdigit())
    if not digits:
        digits = str(sum(ord(ch) for ch in tid) % 10000)
    return digits.zfill(4)[-4:]


def _exp_tradeline(tid: str, creditor: str, account_exp: str | None = None) -> Tradeline:
    return Tradeline(
        id=tid,
        creditor=creditor,
        account_exp=account_exp or _account_from_id(tid),
        account_type="Credit Card",
        status="Open",
        bureaus=["EXP"],
        dispute_bureaus=["EXP"],
        selected=True,
        dispute_reason="Request deletion of inaccurate reporting.",
    )


def test_round1_disputed_status_keeps_grouped_bureau_letters():
    """In-progress statuses must not switch Round 1 onto per-item follow-up letters."""
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


def test_round1_chunks_bureau_letters_at_seven_items():
    tradelines = [_exp_tradeline(f"t{i}", f"CREDITOR {i}") for i in range(8)]
    report = ParsedReport(consumer=ConsumerInfo(name="Test Client"), tradelines=tradelines)
    request = DisputePlanRequest(
        session_id="s1",
        round_number=1,
        selections=[TradelineSelection(id=f"t{i}", selected=True) for i in range(8)],
    )
    result = build_plan("s1", report, request)
    experian = [p for p in result.plans if p.letter_type == "bureau_experian"]
    assert len(experian) == 2
    assert [len(p.items) for p in experian] == [7, 1]
    assert experian[0].recipient_name == "Experian (letter 1 of 2)"
    assert experian[1].recipient_name == "Experian (letter 2 of 2)"


def test_round1_skips_renamed_duplicate_with_same_last4():
    short = _exp_tradeline("kikoff", "KIKOFF", "****1111")
    long = _exp_tradeline("kikoff-llc", "KIKOFF LENDING LLC", "XXXX1111")
    other = _exp_tradeline("cap-one", "CAPITAL ONE", "2222")
    report = ParsedReport(consumer=ConsumerInfo(name="Test Client"), tradelines=[short, long, other])
    request = DisputePlanRequest(
        session_id="s1",
        round_number=1,
        selections=[
            TradelineSelection(id="kikoff", selected=True),
            TradelineSelection(id="kikoff-llc", selected=True),
            TradelineSelection(id="cap-one", selected=True),
        ],
    )
    result = build_plan("s1", report, request)
    experian = next(p for p in result.plans if p.letter_type == "bureau_experian")
    creditors = [item.creditor for item in experian.items]
    assert creditors.count("KIKOFF") + creditors.count("KIKOFF LENDING LLC") == 1
    assert "CAPITAL ONE" in creditors


def test_round2_skips_renamed_duplicate_with_same_last4():
    short = _exp_tradeline("kikoff", "KIKOFF", "****1111")
    long = _exp_tradeline("kikoff-llc", "KIKOFF LENDING LLC", "XXXX1111")
    report = ParsedReport(consumer=ConsumerInfo(name="Test Client"), tradelines=[short, long])
    request = DisputePlanRequest(
        session_id="s1",
        round_number=2,
        selections=[
            TradelineSelection(id="kikoff", selected=True, item_status="verified"),
            TradelineSelection(id="kikoff-llc", selected=True, item_status="verified"),
        ],
    )
    result = build_plan("s1", report, request)
    mov = [p for p in result.plans if p.letter_type == "method_of_verification"]
    assert len(mov) == 1
    assert len(mov[0].items) == 1


if __name__ == "__main__":
    test_selected_inquiry_with_empty_reason_is_in_experian_letter()
    test_round1_disputed_status_keeps_grouped_bureau_letters()
    test_round2_verified_routes_to_method_of_verification()
    test_round2_no_response_routes_to_warning()
    test_round1_chunks_bureau_letters_at_seven_items()
    test_round1_skips_renamed_duplicate_with_same_last4()
    test_round2_skips_renamed_duplicate_with_same_last4()
    print("letter_router tests passed")
