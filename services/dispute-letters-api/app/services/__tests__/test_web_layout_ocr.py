"""Bureau-website and monitoring-app pages read by OCR: screenshots, browser
"Save as PDF" printouts and several screenshots combined. Fake data only."""
from __future__ import annotations

from app.ingest.pdf import _join_pages, _read_rows, strip_print_chrome
from app.services.bureau_text_parser import layout_score, parse_bureau_accounts

ROWS = """
TransUnion Credit Report
SAMPLE BANK USA
Potentially negative
Account Number XXXX1234
Account Type Credit Card
Account Status Open
Payment Status

30 Days Late
Balance $1,234
Credit Limit $2,000
Date Opened 03/2019
Past Due $45
DEMO AUTO FINANCE
Account Number XXXX5678
Account Type Auto Loan
Payment Status Current
Balance $8,900
Credit Limit —
Past Due $0
"""


def _by_name(text: str, file_name: str = "Client Transunion.pdf"):
    tradelines, _consumer, _date = parse_bureau_accounts(text, file_name=file_name)
    return {t.creditor: t for t in tradelines}


def test_label_value_rows_without_colons():
    by_name = _by_name(ROWS)
    assert set(by_name) == {"SAMPLE BANK USA", "DEMO AUTO FINANCE"}
    bank = by_name["SAMPLE BANK USA"]
    assert bank.account_tu == "XXXX1234"
    assert bank.status == "30 Days Late"
    assert bank.balance == "$1,234"
    assert bank.credit_limit == "$2,000"
    assert bank.past_due == "$45"
    auto = by_name["DEMO AUTO FINANCE"]
    assert auto.credit_limit == ""
    assert auto.past_due == "$0"


def test_two_fields_side_by_side():
    text = """
SAMPLE BANK USA
Account Number: XXXX1234 Account Type: Credit Card
Account Status: Open Payment Status: 30 Days Late
Balance: $1,234 Credit Limit: $2,000
"""
    bank = _by_name(text, "Client Equifax.pdf")["SAMPLE BANK USA"]
    assert bank.account_eqf == "XXXX1234"
    assert bank.account_type == "Credit Card"
    assert bank.credit_limit == "$2,000"
    assert bank.status == "30 Days Late"


def test_overlapping_screenshots_do_not_double_or_leak():
    # Screenshot 2 repeats the bottom of screenshot 1, then a stray row from the
    # card above: neither may change the account it lands under.
    text = ROWS + """
Past Due $0
Past Due $640
DEMO AUTO FINANCE
Account Number XXXX5678
Balance $8,900
"""
    by_name = _by_name(text)
    assert len(by_name) == 2
    assert by_name["DEMO AUTO FINANCE"].past_due == "$0"


def test_browser_print_headers_are_removed_at_page_breaks():
    page1 = "11/20/26, 314 PM Credit Report | TransUnion\nSAMPLE BANK USA\nAccount Number XXXX1234\nhttps://example.test/report.page 1/2"
    page2 = "11/20/26, 3:14 PM Credit Report | TransUnion\nBalance $1,234\nPast Due $45\nPage 2 of 2"
    joined = _join_pages([page1, page2])
    assert "PM" not in joined and "https" not in joined and "Page 2" not in joined
    bank = _by_name(joined)["SAMPLE BANK USA"]
    assert bank.balance == "$1,234"
    assert strip_print_chrome("Balance $1,234") == "Balance $1,234"


def test_row_reading_wins_when_columns_came_apart():
    split = "SAMPLE BANK USA\nAccount Number\nBalance\nPast Due\nCredit Limit\nXXXX1234\n$1,234\n$45\n$2,000"
    rows = "SAMPLE BANK USA\nAccount Number XXXX1234\nBalance $1,234\nPast Due $45\nCredit Limit $2,000"
    assert layout_score(rows) > layout_score(split)
    reads = {3: split, 4: rows}
    assert _read_rows(lambda _tile, mode: reads[mode], object()) == rows
    # Plain prose with no account fields is read once.
    calls: list[int] = []
    _read_rows(lambda _tile, mode: calls.append(mode) or "Hello there", object())
    assert calls == [3]


def test_single_screenshot_card_is_kept():
    text = "SAMPLE BANK\nReported: Oct 21, 2026\nBalance: $1,200.00 Credit limit: $3,000.00\n"
    tradelines, _c, _d = parse_bureau_accounts(text, file_name="Client Experian.png")
    assert [t.creditor for t in tradelines] == ["SAMPLE BANK"]
