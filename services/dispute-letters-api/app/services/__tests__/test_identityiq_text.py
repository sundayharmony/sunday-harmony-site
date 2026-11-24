"""IdentityIQ three-bureau PDF text (column layout). Fake data only."""
from __future__ import annotations

from app.models import ExtractedDocument
from app.parsers import identityiq_text
from app.parsers.base import parse_document_fallback

H = "                             TransUnion         Experian          Equifax"
TEXT = f"""
                         Three Bureau Credit Report
Reference #: M00000000
Report Date: 10/01/2026
{H}
          Name:      JANE Q SAMPLE      JANE SAMPLE       JANE Q SAMPLE
  Credit Score:          612               640               598
 Account History
      SAMPLE BANK
{H}

     Account #:      1234****           1234****          -
  Account Type:      Revolving          Revolving         -
Payment Status:      Current            Late 30 Days      -
       Balance:      $500.00            $500.00           -
  Last Reported:     09/30/2026         09/28/2026        -
Two-Year payment history
      DEMO COLLECTIONS
{H}
     Account #:      -                  -                 9999****
  Account Type:      -                  -                 Collection
Payment Status:      -                  -                 Collection/Chargeoff
       Balance:      -                  -                 $310.00
Inquiries
Creditor Name                 Type of Business          Date of inquiry   Credit Bureau
FAKE AUTO LLC                 Automotive                08/01/2026        Experian
"""


def _doc() -> ExtractedDocument:
    return ExtractedDocument(file_type="txt", raw_path="", text=TEXT, extraction_quality="high")


def test_detects_identityiq_text():
    assert identityiq_text.can_parse_text(TEXT)


def test_columns_map_to_bureaus():
    report = parse_document_fallback(_doc(), file_name="report.pdf")
    by_name = {t.creditor: t for t in report.tradelines}
    bank = by_name["SAMPLE BANK"]
    assert bank.bureaus == ["TUC", "EXP"]
    assert bank.account_tu == "1234****" and bank.account_eqf == ""
    assert bank.status == "Late 30 Days"  # worst status across bureaus
    coll = by_name["DEMO COLLECTIONS"]
    assert coll.bureaus == ["EQF"] and coll.is_collection
    inquiry = by_name["FAKE AUTO LLC"]
    assert inquiry.account_type == "Hard Inquiry" and inquiry.bureaus == ["EXP"]
    scores = report.credit_health.scores
    assert (scores.tuc, scores.exp, scores.eqf) == (612, 640, 598)
    assert report.consumer.name == "JANE Q SAMPLE"


class _Page:
    """Stand-in for a pdfplumber page: words with true x positions (points)."""

    def __init__(self, rows):
        self._words = []
        for top, cells in rows:
            for x0, text in cells:
                self._words.append({"text": text, "x0": x0, "x1": x0 + 5.0 * len(text), "top": top})

    def extract_words(self):
        return list(self._words)


def test_long_values_keep_their_own_bureau_column():
    """Wide account numbers used to run together with one space and land in one bureau's cell."""
    rows = [
        (10, [(40, "SAMPLE"), (95, "LOAN")]),
        (30, [(200, "TransUnion"), (330, "Experian"), (460, "Equifax")]),
        (50, [(100, "Account"), (137, "#:"), (190, "1100000000151****"), (320, "1100000000151****"), (450, "1100000000151****")]),
        (60, [(40, "Account"), (77, "Type"), (99, "-"), (106, "Detail:"), (210, "Charge"), (245, "account"), (340, "Charge"), (375, "account"), (470, "Charge"), (505, "account")]),
        (70, [(110, "Balance:"), (230, "$1.00"), (360, "$1.00"), (490, "$1.00")]),
        (80, [(40, "Two-Year"), (90, "payment"), (130, "history")]),
        (90, [(60, "TransUnion"), (150, "OK"), (170, "OK"), (190, "30")]),
        (100, [(60, "Experian"), (150, "OK"), (170, "OK"), (190, "OK")]),
        (110, [(60, "Equifax"), (150, "OK"), (170, "60"), (190, "OK")]),
    ]
    lines = identityiq_text._page_lines(_Page(rows))
    header = next(i for i, ln in enumerate(lines) if "TransUnion" in ln and "Experian" in ln)
    tradeline, _ = identityiq_text._read_account("SAMPLE LOAN", lines, header)
    assert (tradeline.account_tu, tradeline.account_exp, tradeline.account_eqf) == ("1100000000151****",) * 3
    assert tradeline.account_type == "Charge account"  # not "Charge account Charge account"
    # Late marks in the two-year grid are kept, with the bureaus that report them.
    assert "30 days (TransUnion)" in tradeline.payment_history
    assert "60 days (Equifax)" in tradeline.payment_history


def test_clean_history_grid_adds_nothing():
    lines = [
        H,
        "     Account #:      1234****           1234****          1234****",
        "      TransUnion   OK OK OK",
        "         Experian  OK OK OK",
    ]
    tradeline, _ = identityiq_text._read_account("CLEAN BANK", lines, 0)
    assert tradeline.payment_history == ""
