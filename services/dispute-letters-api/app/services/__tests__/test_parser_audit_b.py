"""Root-cause tests for the parser accuracy audit (Credit Hero, Experian grid, SmartCredit). Fake data only."""
from __future__ import annotations

from app.parsers.credit_hero_columns import Line, _compose_status, _grid_lates, _times_late
from app.parsers.smartcredit import _split_three
from app.services.bureau_text_parser import (
    _experian_grid_lates,
    _parse_credit_hero_single_collections,
    parse_bureau_accounts,
)
from app.services.inquiries import _garbled

HERO_CARD = """
Credit Cards
HARBOR BANK NA $120.00
Reported: Sep 1, 2026
Overview Account details
Account Number 1111XXXX
Account Status Open
Balance: $120.00 Credit limit: $1,000.00
Open Date Mar 3, 2018
Type Credit Card
Current Payment Status Current
Times 30/60/90 Days Late 0/0/0
Amount Past Due $0.00
"""

HERO_STUDENT = """
Student Loans
FAKE LOAN SERVICER $900.00
Reported: Sep 1, 2026
Overview Account details
Account Number 2222XXXX
Account Status Open
Balance: $900.00 Credit limit: $1,000.00
Open Date Mar 3, 2016
Type Educational
Current Payment Status Current
Times 30/60/90 Days Late 0/0/0
Amount Past Due $0.00
"""

HERO_COLLECTIONS = """
Accounts passed on to a collections agency
$310.00
Reported: Aug 2, 2026
Original Creditor DEMO TELECOM
Account Number 99887XXXX
Unpaid Balance $310.00
FAKE RECOVERY LLC $55.00
Reported: Aug 3, 2026
Original Creditor SAMPLE CLINIC
Account Number 11223XXXX
Unpaid Balance $55.00
Public records
"""


def test_zero_lates_do_not_mark_account_late():
    tradelines, _, _ = parse_bureau_accounts(HERO_CARD, file_name="credit-hero-score.pdf")
    assert tradelines
    assert all("late" not in (t.payment_history or "").lower() for t in tradelines)


def test_educational_type_is_kept():
    tradelines, _, _ = parse_bureau_accounts(HERO_STUDENT, file_name="credit-hero-score.pdf")
    assert [t.account_type for t in tradelines] == ["Educational"]


def test_single_bureau_collection_cards_with_and_without_agency():
    rows = _parse_credit_hero_single_collections(HERO_COLLECTIONS, "EXP")
    assert len(rows) == 2
    assert {r.account_exp for r in rows} == {"99887XXXX", "11223XXXX"}
    assert any(r.creditor == "FAKE RECOVERY LLC" for r in rows)
    assert all(r.is_collection and r.creditor for r in rows)


def test_experian_grid_counts_late_marks_but_not_legend():
    block = (
        "Payment history\n2026 OK OK 30 OK\n2025 60 OK OK OK 30\n"
        "On Time 30 30 Days Late 60 60 Days Late\n"
    )
    assert _experian_grid_lates(block) == "Late payments: 30 days x2, 60 days x1"
    assert _experian_grid_lates("Payment history\n2026 OK OK\nOn Time\n") == ""


def test_garbled_inquiry_names_are_detected():
    assert _garbled("O Fi N na E n M c A e IN")
    assert not _garbled("SAMPLE BANK NA")


def test_smartcredit_split_handles_absent_bureau_markers():
    assert _split_three("-- $300 $300") == ["", "$300", "$300"]
    assert _split_three("-- Charge Card Revolving") == ["", "Charge Card", "Revolving"]


def test_column_status_and_late_helpers():
    assert _compose_status({"status": "Open", "payment_status": "Current"}).startswith("Open")
    assert _compose_status({"status": "Open", "payment_status": "Current", "standing": "Closed"}).startswith("Closed")
    assert _times_late({0: {"late": "0/0/0"}, 1: {"late": "0/0/0"}}) == ""
    assert _times_late({0: {"late": "1/0/0"}, 1: {"late": "1/0/0"}}) == "Times late 30/60/90: 1/0/0"
    assert _grid_lates("Payment history\n2026 30 OK 60\nPaid on time\n30 days late 30\n") == "30 days x1, 60 days x1"
    assert Line(page=0, top=1.0, text="x", x0=2.0).solo is False
