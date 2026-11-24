"""Parser audit fixes for experian.com, Credit Hero and OCR'd Experian reports. Synthetic data only."""

from __future__ import annotations

from app.models import Tradeline
from app.services.bureau_text_parser import parse_bureau_accounts
from app.services.credit_health import classify_category, enrich_tradeline

EXPERIAN_COM = """
Prepared For ALEX SAMPLE Date generated: Sep 11, 2026
Open accounts
OAKFIELD CREDIT UNION $9,000
Exceptionalpayment history Balance updated Aug 30, 2026
Account info
Account name OAKFIELD CREDIT UNION Balance $9,000
Account number 5551XXXX Balance updated Aug 30, 2026
Original creditor - Original balance $12,000
Company sold - Paid off 25%
Account type Unsecured Monthly payment $300
Date opened Sep 08, 2025 Terms 48 Months
Open/closed Open Responsibility Joint
Status Open/Never late. Your statement -
Status updated Aug 2026
Payment history
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
2026 - - - - - - - -
Current / Terms met -Data Unavailable
Contact info
Address 1 MAIN ST
Phone number (800) 555-0100
Comments
-
Prepared For ALEX SAMPLE Date generated: Sep 11, 2026
HILLTOP RETAIL CARD $120
Exceptionalpayment history Balance updated Aug 12, 2026
Account info
Account name HILLTOP RETAIL CARD Balance $120
Account number 4000XXXXXXXX Balance updated Aug 12, 2026
Original creditor - Credit limit $500
Company sold - Credit usage 24%
Account type Credit card Monthly payment $25
Date opened Dec 29, 2024 Recent Payment $90 as of Jul 15, 2026
Open/closed Open Highest balance $451
Status Open. Terms -
Status updated Aug 2026 Responsibility Individual
Your statement -
Payment history
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
2026 - - - - - 30 - -
Current / Terms met 30Past due 30 days
-Data Unavailable
Contact info
Address PO BOX 1
Phone number (800) 555-0101
Comments
-
Prepared For ALEX SAMPLE Date generated: Sep 11, 2026
Closed accounts
CEDAR LENDING INC
Closed
Exceptionalpayment history
Account info
Account name CEDAR LENDING INC Balance -
Account number 8XXXX Balance updated -
Original creditor - Original balance $565
Company sold - Monthly payment -
Account type Auto Loan Terms 12 Months
Date opened Jan 22, 2020 Responsibility Individual
Open/closed Closed Your statement -
Status Paid, Closed/Never late.
Status updated Jun 2021
Payment history
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
2021 - - - - - CLS
Current / Terms met CLSClosed -Data Unavailable
Contact info
Address 2 OAK ST
Phone number (800) 555-0102
Comments
-
"""


def _parsed():
    tradelines, _, _ = parse_bureau_accounts(EXPERIAN_COM, file_name="Sample Experian.pdf")
    return {tl.creditor: enrich_tradeline(tl) for tl in tradelines}


def test_never_late_open_account_is_clean_not_closed_or_late():
    loan = _parsed()["OAKFIELD CREDIT UNION"]
    assert loan.item_category == "positive"
    assert "closed_account" not in loan.legal_flags
    # "Company sold - Paid off 25%" is a label pair, not a sale of the account.
    assert "sold" not in loan.remarks.lower()
    assert loan.balance == "$9,000"
    assert loan.high_credit == "$12,000"


def test_never_late_closed_account_is_not_a_late_payment():
    closed = _parsed()["CEDAR LENDING INC"]
    assert closed.item_category == "closed"
    assert closed.legal_flags.count("closed_account") == 1
    assert "closed_derogatory" not in closed.legal_flags


def test_payment_history_key_marks_late_history_on_open_account():
    card = _parsed()["HILLTOP RETAIL CARD"]
    assert "Past due 30 days" in card.payment_history
    assert card.item_category == "negative"
    assert card.credit_limit == "$500"
    assert card.high_credit == "$451"
    assert "sold" not in card.remarks.lower()


def test_short_masked_account_ids_are_kept():
    by_name = _parsed()
    assert by_name["CEDAR LENDING INC"].account_exp == "8XXXX"


def test_never_late_phrase_does_not_classify_as_late():
    tl = Tradeline(id="t", creditor="TEST BANK", status="Open/Never late.", account_type="Credit card")
    assert classify_category(tl) == "positive"


def test_collection_charge_off_wording_is_a_charge_off_not_a_collection():
    tl = Tradeline(
        id="t",
        creditor="TEST LENDER",
        status="Charge Off. Collection/Charge-off",
        account_type="Unsecured",
    )
    assert classify_category(tl) == "charge_off"


CREDIT_HERO = """
Credit cards
SAMPLE BANK NA $904.00
Reported: Oct 27, 2026 In good standing
Overview Account details
Account Number 483950XXXXXX
Account Status Open
Balance: $904.00 Credit limit: $1,000.00
Open Date Aug 23, 2016
Type Credit Card
Remarks This Is An Account In Good Standing
Times 30/60/90 Days Late 0/0/0
High Balance $1,073.00
High Credit $1,000.00
Creditor information
SAMPLE BANK NA
Monthly Payment Amount $35.00
Current Payment Status As Agreed
Amount Past Due $0.00
Student loans
SAMPLE LOANS SERVICING $2,981.00
Reported: Sep 30, 2026 In good standing
Overview Account details
Account Number 139922XXXXXXXXXX
Account Status Open
Balance: $2,981.00 Highest balance: $6,000.00
Open Date Oct 7, 2021
Type Educational
Remarks This Is An Account In Good Standing
Times 30/60/90 Days Late 0/0/0
High Balance $6,000.00
High Credit $0.00
Creditor information
SAMPLE LOANS SERVICING
Monthly Payment Amount $60.00
Current Payment Status As Agreed
Amount Past Due $0.00
Other
SAMPLE FINANCE CO $713.00
Reported: Oct 3, 2026 Closed — derogatory
Overview Account details
Account Number 4NZHUSXX
Account Status Charge Off
Balance: $713.00 Highest balance: $2,087.00
Open Date Mar 1, 2025
Type Unsecured
Remarks Unpaid Balance Reported As A Loss By Credit Grantor
Times 30/60/90 Days Late 1/1/1
High Balance $2,087.00
High Credit $0.00
Creditor information
SAMPLE FINANCE CO
Monthly Payment Amount $0.00
Current Payment Status Collection/Charge-off
Amount Past Due $713.00
"""


def _hero():
    tradelines, _, _ = parse_bureau_accounts(CREDIT_HERO, file_name="Sample Experian.pdf")
    return {tl.creditor: enrich_tradeline(tl) for tl in tradelines}


def test_credit_hero_zero_lates_stays_clean():
    card = _hero()["SAMPLE BANK NA"]
    assert card.payment_history == ""
    assert card.item_category == "positive"
    assert card.last_reported == "Oct 27, 2026"
    # High Balance is the real peak; High Credit repeats the limit.
    assert card.high_credit == "$1,073.00"


def test_credit_hero_reads_educational_type():
    loan = _hero()["SAMPLE LOANS SERVICING"]
    assert loan.account_type == "Educational"
    assert loan.high_credit == "$6,000.00"


def test_credit_hero_charge_off_is_not_flagged_as_collection():
    bad = _hero()["SAMPLE FINANCE CO"]
    assert bad.is_collection is False
    assert bad.item_category == "charge_off"
    assert "Loss" in bad.remarks


OCR_EXPERIAN = """
Accounts
SAMPLE STUDENT LOANS
Account Info
Account Name SAMPLE STUDENT LOANS Balance
Account Number 5B5250XXXXXXXXXX Balance Updated -
Account Type Education Recent Payment -
Responsibility Joint with PAT EXAMPLE Monthly Payment
Interest Type - Original Balance $33,020
Date Opened 09/28/2021 Highest Balance -
Status Paid, Closed/Never late. Terms 180 Months
Status Updated Dec 2023 On Record Until Dec 2033
(8] Payment History
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
2023 v v v v v v v v v v v CLS
Balance Histories
Date Balance Scheduled Payment Paid
SAMPLE STUDENT LOANS
Account Info
Account Name SAMPLE STUDENT LOANS Balance -
Account Number 5B5250XXXXXXXXXX Balance Updated -
Account Type Education Recent Payment -
Responsibility Joint with PAT EXAMPLE Monthly Payment
Interest Type - Original Balance $19,444
Date Opened 01/11/2022 Highest Balance -
Status Paid, Closed/Never late. Terms 180 Months
Status Updated Dec 2023 On Record Until Dec 2033
& Contact Info
Address PO BOX 1
*/SAMPLE AUTO FINANCE
Account Info
‘Account Name */SAMPLE AUTO FINANCE Balance $22,500
Account Number 6201 06XXXXXXXXXXX Balance Updated 03/31/2026
‘Account Type Auto Loan Recent Payment $455 as of 3/27/2026
Responsibility Individual Monthly Payment $455
Interest Type Fixed Original Balance $23,528
Date Opened 10/22/2025 Highest Balance
Status Open/Never late. Terms 73 Months
Status Updated Mar 2026
(8] Payment History
Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
2026 v v v - - - - - - - - -
Balance Histories
Date Balance Scheduled Payment Paid
Jan 2026 $22,232 $522 $600 on 1/28/2026
"""


def _ocr():
    tradelines, _, _ = parse_bureau_accounts(OCR_EXPERIAN, file_name="Sample Experian.pdf")
    return tradelines


def test_ocr_accounts_sharing_a_masked_number_stay_separate():
    loans = [tl for tl in _ocr() if tl.creditor == "SAMPLE STUDENT LOANS"]
    assert sorted(tl.date_opened for tl in loans) == ["01/11/2022", "09/28/2021"]


def test_ocr_icon_prefixed_account_name_starts_its_own_account():
    auto = next(tl for tl in _ocr() if "AUTO" in tl.creditor)
    assert auto.creditor == "SAMPLE AUTO FINANCE"
    assert auto.account_type == "Auto Loan"
    assert auto.date_opened == "10/22/2025"
    assert len(_ocr()) == 3


def test_ocr_balance_row_survives_balance_histories_and_split_cells():
    auto = next(tl for tl in _ocr() if "AUTO" in tl.creditor)
    assert auto.balance == "$22,500"
    assert auto.high_credit == "$23,528"
    assert auto.monthly_payment == "$455"
    assert auto.account_exp == "620106XXXXXXXXXXX"
