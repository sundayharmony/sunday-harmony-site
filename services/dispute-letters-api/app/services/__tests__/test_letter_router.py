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


if __name__ == "__main__":
    test_selected_inquiry_with_empty_reason_is_in_experian_letter()
    print("letter_router tests passed")
