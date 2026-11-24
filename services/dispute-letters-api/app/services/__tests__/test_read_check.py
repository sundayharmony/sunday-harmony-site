"""The read is checked against totals the report prints about itself. Fake data."""
from __future__ import annotations

from app.models import ParsedReport, Tradeline
from app.services.read_check import check_read


def _report(*bureau_lists: list[str], inquiries: int = 0) -> ParsedReport:
    rows = [Tradeline(id=f"a{i}", creditor=f"BANK {i}", bureaus=b) for i, b in enumerate(bureau_lists)]
    rows += [Tradeline(id=f"q{i}", creditor="LENDER", account_type="Hard Inquiry", bureaus=["EXP"]) for i in range(inquiries)]
    return ParsedReport(tradelines=rows)


def test_three_bureau_totals_follow_the_reports_column_order():
    text = "Credit Hero Score\nTotal accounts 2 1 1\nOpen accounts 1 1 1\n"
    # Credit Hero prints TransUnion, Equifax, Experian.
    ok = _report(["TUC", "EQF"], ["TUC", "EXP"])
    assert check_read(ok, text) == []
    short = _report(["TUC", "EQF"])
    assert check_read(short, text) == ["TransUnion lists 2 accounts; 1 were read.", "Experian lists 1 accounts; 0 were read."]


def test_identityiq_header_order():
    text = "TransUnion Experian Equifax\nTotal Accounts: 1 2 0\n"
    assert check_read(_report(["TUC", "EXP"], ["EXP"]), text) == []


def test_monitoring_site_open_plus_closed():
    text = "Balances Payments Open accounts Closed accounts\n$1,200 $90 1 2\n"
    assert check_read(_report(["EQF"], ["EQF"], ["EQF"]), text) == []
    assert check_read(_report(["EQF"]), text) == ["This report lists 3 accounts; 1 were read."]


def test_open_accounts_alone_is_not_trusted_and_inquiries_do_not_count():
    text = "Open accounts 1 Credit card and credit line $200\nClosed accounts 0\n"
    assert check_read(_report(["EXP"], ["EXP"], inquiries=3), text) == []


def test_stated_inquiry_total():
    text = "Hard Inquiries (2 Total)\n"
    assert check_read(_report(inquiries=1), text) == ["Report lists 2 hard inquiries; 1 were read."]
