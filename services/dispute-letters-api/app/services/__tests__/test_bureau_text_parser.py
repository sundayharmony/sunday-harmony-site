"""Local bureau text parsing. Fixtures are synthetic."""

from __future__ import annotations

from app.services.bureau_text_parser import parse_bureau_accounts, parse_bureau_text
from app.services.report_extractor import extract_from_text

EXPERIAN_TEXT = """
Prepared For JANE Q PUBLIC Date generated: Sep 11, 2026
Experian
FICO Score 8
612
Account summary
Open accounts 0
Closed accounts 3 collections debt $4,200

Closed accounts
NORTHWIND AUTO FINANCE $8,430
potentially negative Closed
\ue000Account info
Account name NORTHWIND AUTO FINANCE Balance $8,430
Account number 481200009999 Balance updated Aug 11, 2026
Original creditor - Original balance $18,200
Company sold - Monthly payment -
Account type Auto Loan Past due amount $8,430
Date opened May 2, 2019 Terms 72 Months
Open/Closed Closed Responsibility Individual
Status Repossession. $8,430 past Your statement -
due as of Aug 2026
Status updated Nov 2025
Payment history
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec

HARBOR CARD SERVICES $640
potentially negative Closed
Account info
Account name HARBOR CARD SERVICES Balance $640
Account number 555544443333 Balance updated Nov 2, 2025
Original creditor - Credit limit $1,000
Company sold - Monthly payment -
Account type Charge Card Past due amount $640
Date opened Mar 4, 2020 Highest balance $980
Open/Closed Closed Terms -
Status Account charged off. $640 Responsibility Individual
charged off. $640 past due as of
Your statement -
Nov 2025
Status updated Nov 2025
Payment history
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec

Collection accounts
SUMMIT RECEIVABLES $2,150
Original creditor: ALPINE MOBILE
Account info
Account name SUMMIT RECEIVABLES Balance $2,150
Account number 99887766 Balance updated Sep 1, 2026
Original creditor ALPINE MOBILE Original balance $2,150
Company sold - Monthly payment -
Account type Collection Past due amount $2,150
Date opened May 9, 2024 Terms 1 Month
Status Collection account. $2,150 Responsibility Individual
past due as of Sep 2026
Your statement -
Status updated May 2026
Payment history
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec

Public records
No public records reported.
"""

COLON_TEXT = """
TransUnion consumer disclosure

Creditor: PINELAKE WIRELESS
Account Number: 1122334455
Account Type: Telecommunications
Status: Collection
Balance: $420
Past Due: $420
Date Opened: 11/2018

Creditor: OAK STREET BANK
Account Number: ****6789
Account Type: Credit Card
Status: Open/Never late
Balance: $350
Date Opened: 01/15/2021
Credit Limit: $2,500
"""

STACKED_TEXT = """
Equifax
Account Name
NORTH STAR BANK
Account Number
****4321
Account Type
Credit Card
Date Opened
01/15/2018
Balance
$500
Status
Open/Never late
Credit Limit
$2,500

Account Name
RIVERBEND COLLECTIONS
Account Number
****9988
Account Type
Collection
Status
Collection
Balance
$1,200
Past Due
$1,200
Date Opened
06/2019
"""

NARRATIVE = (
    "This handbook explains how credit scores are calculated for consumers in general. "
    "It does not list furnisher accounts, balances, or statuses."
)


def test_experian_text_extracts_accounts_and_ignores_summary():
    tradelines, consumer, report_date = parse_bureau_accounts(
        EXPERIAN_TEXT, file_name="Jane Public Experian.pdf"
    )
    by_name = {tl.creditor: tl for tl in tradelines}
    assert set(by_name) == {
        "NORTHWIND AUTO FINANCE",
        "HARBOR CARD SERVICES",
        "SUMMIT RECEIVABLES",
    }
    assert consumer.name == "JANE Q PUBLIC"
    assert report_date == "Sep 11, 2026"

    auto = by_name["NORTHWIND AUTO FINANCE"]
    assert auto.account_exp == "481200009999"
    assert auto.bureaus == ["EXP"]
    assert auto.balance == "$8,430"
    assert auto.account_type == "Auto Loan"
    assert auto.date_opened == "May 2, 2019"
    assert auto.past_due == "$8,430"
    assert auto.high_credit == "$18,200"
    assert "Reposses" in auto.status or "Repossession" in auto.status
    assert "Closed" in auto.status
    assert auto.last_reported == "Aug 11, 2026"
    assert "72 Months" in auto.remarks

    card = by_name["HARBOR CARD SERVICES"]
    assert card.balance == "$640"
    assert card.credit_limit == "$1,000"
    assert card.high_credit == "$980"
    assert "charged off" in card.status.lower()
    assert "past due" in card.status.lower()
    assert "Nov 2025" in card.status
    assert card.account_type == "Charge Card"

    collection = by_name["SUMMIT RECEIVABLES"]
    assert collection.is_collection is True
    assert collection.account_type == "Collection"
    assert "ALPINE MOBILE" in collection.remarks
    assert collection.balance == "$2,150"
    assert collection.date_opened == "May 9, 2024"


def test_letter_only_account_ids_are_kept():
    text = """
    Experian
    Account info
    Account name NORTHWIND AUTO FINANCE Balance $8,430
    Account number PLNMQZ Balance updated Aug 11, 2026
    Account type Auto Loan Past due amount $8,430
    Date opened May 2, 2019 Terms 72 Months
    Open/Closed Closed Responsibility Individual
    Status Repossession Your statement -
    """
    tradelines, _, _ = parse_bureau_accounts(text, file_name="sample-experian.pdf")
    assert tradelines[0].account_exp == "PLNMQZ"


def test_creditor_may_start_with_a_right_column_word():
    text = """
    Experian
    Account info
    Account name BALANCE FIRST BANK Balance $10
    Account number 12345678 Balance updated Jan 2, 2024
    Account type Credit Card Past due amount $0
    Date opened Jan 2, 2020 Terms -
    Open/Closed Open Responsibility Individual
    Status Current Your statement -
    """
    tradelines, _, _ = parse_bureau_accounts(text, file_name="sample-experian.pdf")
    assert [tl.creditor for tl in tradelines] == ["BALANCE FIRST BANK"]
    assert tradelines[0].balance == "$10"
    assert tradelines[0].account_exp == "12345678"


def test_colon_labels_extract_transunion_accounts():
    tradelines, _, _ = parse_bureau_accounts(COLON_TEXT, file_name="report-transunion.txt")
    by_name = {tl.creditor: tl for tl in tradelines}
    assert set(by_name) == {"PINELAKE WIRELESS", "OAK STREET BANK"}
    wireless = by_name["PINELAKE WIRELESS"]
    assert wireless.bureaus == ["TUC"]
    assert wireless.account_tu == "1122334455"
    assert wireless.is_collection is True
    assert wireless.balance == "$420"
    assert wireless.past_due == "$420"
    assert wireless.date_opened == "11/2018"
    card = by_name["OAK STREET BANK"]
    assert card.account_tu == "****6789"
    assert card.credit_limit == "$2,500"
    assert card.status == "Open/Never late"


def test_stacked_labels_extract_equifax_accounts():
    tradelines, _, _ = parse_bureau_accounts(STACKED_TEXT, file_name="equifax-disclosure.pdf")
    by_name = {tl.creditor: tl for tl in tradelines}
    assert set(by_name) == {"NORTH STAR BANK", "RIVERBEND COLLECTIONS"}
    assert by_name["NORTH STAR BANK"].bureaus == ["EQF"]
    assert by_name["NORTH STAR BANK"].account_eqf == "****4321"
    assert by_name["NORTH STAR BANK"].balance == "$500"
    assert by_name["RIVERBEND COLLECTIONS"].is_collection is True
    assert by_name["RIVERBEND COLLECTIONS"].past_due == "$1,200"


def test_narrative_and_summary_do_not_invent_accounts():
    assert parse_bureau_accounts(NARRATIVE, file_name="notes.pdf")[0] == []
    summary = "Closed accounts 2 collections debt $4,200\nOpen accounts 0\nExperian credit score 612\n"
    assert parse_bureau_accounts(summary, file_name="Experian.pdf")[0] == []
    assert parse_bureau_text(NARRATIVE, file_name="notes.pdf") is None


def test_extract_from_text_stays_local_when_api_key_is_set(monkeypatch):
    monkeypatch.setenv("CURSOR_API_KEY", "test-key")
    report = extract_from_text(
        EXPERIAN_TEXT, "pdf", False, "high", file_name="Jane Public Experian.pdf"
    )
    assert len(report.tradelines) == 3
    assert report.source == "fallback_parser"
    assert report.tradelines[0].account_exp
