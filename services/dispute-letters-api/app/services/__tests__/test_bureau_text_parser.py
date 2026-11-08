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


CREDIT_HERO_MEMBER = """
We gathered all of the accounts listed on your Experian report for you.
Overview Account details
You’re currently using 22% of your account's limit.
Account Number 426412XXXX
Account Status Open
Balance: $640.00 Credit limit: $3,000.00
Open Date Aug 14, 2019
Type Credit Card
Responsibility Individual
Remarks This Is An Account In Good Standing
High Balance $2,100.00
Repossession or Collection or Creditor information
foreclosure charge off HARBOR BANK NA
Voluntary PO BOX 100
Account ID:abc
Monthly Payment Amount $35.00
Current Payment Status As Agreed
Amount Past Due $0.00
Overview Account details
Account Number 998877XXXX
Account Status Closed
Balance: $0.00 Credit limit: $500.00
Open Date Jan 2, 2016
Type Collection
Remarks Collection account
foreclosure charge off PINE COLLECTIONS
Monthly Payment Amount $0.00
Current Payment Status Collection
Amount Past Due $120.00
"""

CREDIT_HERO_TRI = """
Account Number 1111XXXX Account Number 2222XXXX Account Number 3333XXXX
Account Status Open Account Status Open Account Status Open
Open Date Mar 3, 2018 Open Date Mar 3, 2018 Open Date Mar 3, 2018
Type Credit Card Type Credit Card Type Credit Card
Balance: $100.00 Credit limit: $1,000.00 Balance: $90.00 Credit limit: $1,000.00 Balance: $80.00 Credit limit: $1,000.00
foreclosure charge off HARBOR BANK NA
Account ID:abc
"""


def test_credit_hero_member_pdf_extracts_each_bureau_account():
    tradelines, _, _ = parse_bureau_accounts(CREDIT_HERO_MEMBER, file_name="sample-experian.pdf")
    by_name = {tl.creditor: tl for tl in tradelines}
    assert set(by_name) == {"HARBOR BANK NA", "PINE COLLECTIONS"}
    card = by_name["HARBOR BANK NA"]
    assert card.bureaus == ["EXP"]
    assert card.account_exp == "426412XXXX"
    assert card.balance == "$640.00"
    assert card.credit_limit == "$3,000.00"
    assert card.date_opened == "Aug 14, 2019"
    assert card.account_type == "Credit Card"
    assert card.status.startswith("Open")
    assert by_name["PINE COLLECTIONS"].is_collection is True


def test_credit_hero_tri_merge_keeps_one_row_per_account():
    tradelines, _, _ = parse_bureau_accounts(CREDIT_HERO_TRI, file_name="credit-hero-score.pdf")
    assert len(tradelines) == 1
    row = tradelines[0]
    assert row.creditor == "HARBOR BANK NA"
    assert row.account_tu == "1111XXXX"
    assert row.account_eqf == "2222XXXX"
    assert row.account_exp == "3333XXXX"
    assert row.bureaus == ["TUC", "EQF", "EXP"]
    assert row.balance == "$100.00"


def test_credit_hero_stacked_columns_still_extract():
    text = """
    Account details Account details Account details
    Account Account Account
    1111XXXX 2222XXXX 3333XXXX
    Number Number Number
    Account Status Open Account Status Open Account Status Open
    Open Date Mar 3, 2018 Open Date Mar 3, 2018 Open Date Mar 3, 2018
    Type Credit Card Type Credit Card Type Credit Card
    Balance: $100.00
    foreclosure charge off HARBOR BANK NA
    Account ID:abc
    """
    tradelines, _, _ = parse_bureau_accounts(text, file_name="credit-hero-score.pdf")
    assert len(tradelines) == 1
    assert tradelines[0].account_tu == "1111XXXX"
    assert tradelines[0].account_eqf == "2222XXXX"
    assert tradelines[0].account_exp == "3333XXXX"


CREDIT_HERO_ALLY_LATE = """
We gathered all of the accounts listed on your TransUnion report for you.
Overview Account details
Account Number 228533XXXXXX
Account Status Open
Balance: $18703.00 Credit limit: $0.00
Open Date May 19, 2022
Type Auto Loan
Responsibility Individual
Remarks Account Information Disputed By Consumer
High Balance $18169.00
Repossession or Collection or Creditor information
foreclosure charge off ALLY FINCL
Voluntary Term Source Type Provided
PO BOX 380901 BLOOMINGTON MN
Account ID:7338b164c40647403b744ff4f161c70a
Monthly Payment Amount $550.00
Current Payment Status Late 30 Days
Amount Past Due $250.00
Terms Count 66
Times 30/60/90 Days Late 1/0/0
"""


def test_credit_hero_ally_late_keeps_real_creditor_and_late_status():
    from app.services.credit_health import classify_category, enrich_tradeline, is_negative_tradeline

    tradelines, _, _ = parse_bureau_accounts(
        CREDIT_HERO_ALLY_LATE, file_name="transunion_10-7.pdf"
    )
    assert len(tradelines) == 1
    ally = enrich_tradeline(tradelines[0])
    assert ally.creditor == "ALLY FINCL"
    assert ally.bureaus == ["TUC"]
    assert ally.balance == "$18703.00"
    assert ally.past_due == "$250.00"
    assert "Late 30" in ally.status
    assert "1/0/0" in ally.payment_history
    assert is_negative_tradeline(ally) is True
    assert classify_category(ally) == "late_payment"


def test_credit_hero_creditor_from_po_box_when_charge_off_is_chrome():
    text = """
We gathered all of the accounts listed on your TransUnion report for you.
Overview Account details
Account Number 228533XXXXXX
Account Status Open
Balance: $18703.00 Credit limit: $0.00
Open Date May 19, 2022
Type Auto Loan
High Balance $18169.00
Repossession or Collection or Creditor information
foreclosure charge off Creditor information
Voluntary Term Source Type Provided
ALLY FINCL
PO BOX 380901 BLOOMINGTON MN
Account ID:7338b164
Monthly Payment Amount $550.00
Current Payment Status Late 30 Days
Amount Past Due $250.00
Times 30/60/90 Days Late 1/0/0
"""
    tradelines, _, _ = parse_bureau_accounts(text, file_name="transunion_10-7.pdf")
    assert len(tradelines) == 1
    assert tradelines[0].creditor == "ALLY FINCL"
    assert tradelines[0].past_due == "$250.00"


def test_credit_hero_member_header_and_creditor_information_names():
    """pdfplumber Credit Hero layout: name sits before Overview Account details."""
    text = """
We gathered all of the accounts listed on your TransUnion report for you.
Credit cards CAPITAL ONE $1,916.00 Reported: Sep 3, 2026 In good standing
Overview Account details
Account Number 517805XXXXXX
Account Status Open
Balance: $1,916.00 Credit limit: $1,850.00
Open Date Sep 13, 2018
Type Credit Card
Times 30/60/90 Days Late 3/1/0
foreclosure charge off Creditor information Voluntary
CAPITAL ONE PO BOX 31293
Monthly Payment Amount $106.00
Current Payment Status As Agreed
Amount Past Due $0.00
CURRENT $0.00 Reported: Aug 31, 2026 In good standing
Overview Account details
Account Number 7991C2XXXXXXXXXXXX
Account Status Open
Balance: $0.00 Credit limit: $0.00
Open Date Oct 9, 2024
Type Credit Card
Creditor information CURRENT
217 CENTRE ST
Monthly Payment Amount $0.00
Current Payment Status As Agreed
Amount Past Due $0.00
CHIMEFINAL $0.00 Reported: Jun 2, 2026 In good standing
Overview Account details
Account Number 727144XXXXXXXXX
Account Status Open
Balance: $0.00 Credit limit: $0.00
Open Date Dec 7, 2025
Type Credit Card
Creditor information Amount Past Due $0.00 CHIMEFINAL
101 CALIFORNIA STREET
Current Payment Status As Agreed
DISCOVERCARD $306.00 Reported: Jun 23, 2026 Closed
Overview Account details
Account Number 601100XXXXXX
Account Status Closed
Balance: $306.00 Credit limit: $500.00
Open Date Dec 14, 2025
Type Credit Card
Times 30/60/90 Days Late 1/0/0
Creditor information DISCOVERCARD
PO BOX 30939
Current Payment Status Late 30 Days
Amount Past Due $70.00
Auto loans ALLY FINCL $18,703.00 Reported: Aug 19, 2026 Past due
Overview Account details
Account Number 228533XXXXXX
Account Status Open
Balance: $18,703.00
Open Date May 19, 2026
Type Auto Loan
Times 30/60/90 Days Late 1/0/0
Creditor information ALLY FINCL P.O. BOX 380901
Current Payment Status Late 30 Days
Amount Past Due $250.00
"""
    tradelines, _, _ = parse_bureau_accounts(text, file_name="transunion_10-7.pdf")
    by_name = {tl.creditor: tl for tl in tradelines}
    assert set(by_name) == {
        "CAPITAL ONE",
        "CURRENT",
        "CHIMEFINAL",
        "DISCOVERCARD",
        "ALLY FINCL",
    }
    assert by_name["DISCOVERCARD"].past_due == "$70.00"
    assert "Late 30" in by_name["DISCOVERCARD"].status
    assert by_name["ALLY FINCL"].past_due == "$250.00"
    assert not any(name.lower().startswith("unnamed") for name in by_name)


def test_equifax_discover_c_header_and_prefers_cap_one_over_grid_chrome():
    text = """
We gathered all of the accounts listed on your Equifax report for you.
Credit cards CAP ONE $1,916.00 Reported: Sep 1, 2026 In good standing
Overview Account details
Account Number 517805XXXXXX
Account Status Open
Balance: $1,916.00 Credit limit: $1,850.00
Type Credit Card
Creditor information BR B Bankruptcy RF CC foreclosure charge off CAP ONE
Voluntary VS surrender
Current Payment Status As Agreed
Amount Past Due $0.00
DISCOVER C $306.00 Reported: Jun 1, 2026 In good standing
Overview Account details
Account Number 601100XXXXXX
Account Status Open
Balance: $306.00 Credit limit: $500.00
Type Credit Card
Times 30/60/90 Days Late 1/0/0
Creditor information Unavailable
Current Payment Status Late 30 Days
Amount Past Due $70.00
"""
    tradelines, _, _ = parse_bureau_accounts(text, file_name="Equifax_10-7.pdf")
    by_acct = {
        (tl.account_eqf or tl.account_tu or ""): tl.creditor for tl in tradelines
    }
    assert by_acct["517805XXXXXX"] == "CAP ONE"
    assert by_acct["601100XXXXXX"] == "DISCOVER C"
    assert "Unnamed" not in by_acct["601100XXXXXX"]


def test_credit_hero_rejects_label_chrome_as_creditor():
    text = """
We gathered all of the accounts listed on your TransUnion report for you.
Overview Account details
Account Number 111XXXX
Account Status Open
Balance: $1916.00 Credit limit: $2000.00
Open Date Jan 1, 2020
Type Credit Card
foreclosure charge off Creditor information
Voluntary Term Source Type
PO BOX 1
Current Payment Status As Agreed
Amount Past Due $0.00
Overview Account details
Account Number 222XXXX
Account Status Open
Balance: $0.00 Credit limit: $0.00
Open Date Jan 1, 2020
Type Auto Loan
foreclosure charge off High Balance
Voluntary Term Source Type Provided
Current Payment Status As Agreed
Amount Past Due $0.00
Overview Account details
Account Number 555XXXX
Account Status Open
Balance: $18703.00 Credit limit: $0.00
Open Date Jan 1, 2020
Type Auto Loan
foreclosure charge off Creditor information ALLY FINCL
Voluntary Term Source Type Provided
Current Payment Status Late 30 Days
Amount Past Due $250.00
Times 30/60/90 Days Late 1/0/0
"""
    tradelines, _, _ = parse_bureau_accounts(text, file_name="transunion_10-7.pdf")
    names = {tl.creditor for tl in tradelines}
    assert "ALLY FINCL" in names
    assert "Creditor information" not in names
    assert "High Balance" not in names
    assert not any(name.lower().startswith("voluntary") for name in names)
    # Chrome-only charge-off rows keep a provisional name so Health is not empty.
    provisional = [name for name in names if name.lower().startswith("unnamed")]
    assert provisional
    from app.services.bureau_text_parser import parse_bureau_text

    report = parse_bureau_text(text, file_name="transunion_10-7.pdf")
    assert report is not None
    assert report.extraction_quality == "low"
