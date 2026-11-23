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
