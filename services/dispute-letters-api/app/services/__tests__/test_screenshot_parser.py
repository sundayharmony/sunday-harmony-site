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
