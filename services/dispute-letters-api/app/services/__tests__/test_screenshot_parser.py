"""Bureau-website screenshots (FullPage Capture) read through OCR. Fake data only."""
from __future__ import annotations

from app.services.bureau_text_parser import parse_bureau_accounts

OCR_TEXT = """
SAMPLE BANK $1,200.00
Reported: Oct 21, 2026
Overview
Youre curently using 40% of your account limit.
Balance: $1,200.00 Credit limit: $3,000.00
Current Payment Status Late 30 Days
Amount Past Due $45.00
Monthly Payment Amount $35.00
Kove ING
Reported: Oct 21, 2026
DEMO COLLECTIONS LLC
Report Ost 12,2026 fe Pastave
Balance: $400.00
Curont Paymert Statue Collection
FAKE CARD CO
Reported: Sep 3, 2026
Balance: $0.00 Credit limit: $500.00
"""


def test_screenshot_cards_become_accounts():
    tradelines, _consumer, _date = parse_bureau_accounts(OCR_TEXT, file_name="Client Transunion.pdf")
    by_name = {t.creditor: t for t in tradelines}
    assert set(by_name) == {"SAMPLE BANK", "DEMO COLLECTIONS LLC", "FAKE CARD CO"}
    bank = by_name["SAMPLE BANK"]
    assert bank.balance == "$1,200.00"
    assert bank.credit_limit == "$3,000.00"
    assert bank.status == "Late 30 Days"
    assert bank.past_due == "$45.00"
    assert bank.last_reported == "Oct 21, 2026"
    assert bank.bureaus == ["TUC"]
    assert "screenshot" in bank.analysis_notes
    coll = by_name["DEMO COLLECTIONS LLC"]
    assert coll.last_reported == "Oct 12, 2026"
    assert coll.status == "Collection"


def test_section_headings_set_account_type():
    from app.services.screenshot_parser import parse_screenshot_accounts

    text = (
        "Credit cards\nSAMPLE BANK\nReported: Oct 21, 2026\nBalance: $100.00 Credit limit: $500.00\n"
        "Auto loans\nDEMO AUTO\nReported: Oct 2, 2026\nBalance: $8,400.00\n"
        "Collections\nFAKE RECOVERY\nReported: Sep 3, 2026\nBalance: $871.00\n"
    )
    types = {t.creditor: (t.account_type, t.is_collection) for t in parse_screenshot_accounts(text, "EXP")}
    assert types == {
        "SAMPLE BANK": ("Credit Card (Revolving)", False),
        "DEMO AUTO": ("Auto Loan (Installment)", False),
        "FAKE RECOVERY": ("Collection", True),
    }


def _cards(text, bureau="EQF"):
    from app.services.screenshot_parser import parse_screenshot_accounts

    return parse_screenshot_accounts(text, bureau)


def test_collection_card_without_a_name_uses_the_original_creditor():
    text = (
        "Collections\n$871.00\nReported: Nov 1, 2026 @ Outstanding\n"
        "Payment history 'Account details\nCurrent Rating Collection/Charge-off\n"
        "Original Creditor FAKE MOBILE\nHigh Balance $871.00\n"
    )
    (card,) = _cards(text)
    assert card.creditor == "FAKE MOBILE" and card.balance == "$871.00"
    assert card.is_collection and card.status == "Collection" and card.account_type == "Collection"


def test_collection_card_is_found_without_a_collections_heading():
    text = (
        "FAKE RECOVERY $400.00\nReported: Oct 1, 2026 @ Outstanding\nPayment history 'Account details\n"
        "Current Rating Collection/Charge-off\nCollection agency\n"
    )
    (card,) = _cards(text)
    assert card.is_collection and card.account_type == "Collection"


def test_card_with_garbled_reported_line_is_kept_via_account_details():
    text = (
        "Other\nFAKE LENDER $0.00\nReported: Mar 9, 2026 Closed\nOverview 'Account details\n"
        "Balance: $0.00 Highest balance: $511.00 Account Status Closed\nType Secured\n"
        "Current Payment Status As Agreed\n"
        "| SAMPLE RENT $0.00\npp eres 208 © tn good standing\nOverview 'Account details\n"
        "Balance: $0.00\nType Rental Agreement\nCurrent Payment Status As Agreed\n"
    )
    cards = {c.creditor: c for c in _cards(text)}
    assert set(cards) == {"FAKE LENDER", "SAMPLE RENT"}
    assert cards["FAKE LENDER"].account_type == "Secured (Installment)"
    assert cards["FAKE LENDER"].high_credit == "$511.00"
    assert cards["FAKE LENDER"].remarks == "Closed account"
    assert cards["SAMPLE RENT"].account_type == "Rental Agreement (Other)"
    assert cards["SAMPLE RENT"].status == "Current"  # "As Agreed"


def test_other_section_cards_get_the_cards_own_type_and_junk_after_the_amount_is_dropped():
    text = (
        "Other\nDEMO CREDIT $0.00 A\nReported: Jun 17, 2024 Closed\nOverview 'Account details\n"
        "Type Credit Line Secured\nCurrent Payment Status Late 20 Days\n"
    )
    (card,) = _cards(text)
    assert card.creditor == "DEMO CREDIT"
    assert card.account_type == "Credit Line Secured (Revolving)"
    assert card.status == "Late 30 Days"  # cards only print 30/60/90/120/150/180; OCR read "30" as "20"


def test_folded_closed_accounts_are_called_out():
    from app.models import ExtractedDocument
    from app.services.report_analyzer import analyze_report

    text = "Credit cards\nSAMPLE BANK $10.00\nReported: Oct 21, 2026\nBalance: $10.00 Credit limit: $500.00\nShow 4 Closed Accounts\n"
    doc = ExtractedDocument(file_type="pdf", raw_path="", text=text, ocr_used=True, extraction_quality="medium")
    report = analyze_report(doc, file_name="Client Experian.pdf")
    assert "4 closed account(s) were folded away" in report.analysis_summary
