"""Hard inquiries for Experian grid, myEquifax/TU list and SmartCredit table. Fake data."""
from __future__ import annotations

from app.models import ExtractedDocument, ParsedReport
from app.services.inquiries import add_inquiries


def _doc(text: str) -> ExtractedDocument:
    return ExtractedDocument(file_type="txt", raw_path="", text=text)


def _names(report: ParsedReport) -> list[tuple[str, str, list[str]]]:
    return [(t.creditor, t.date_opened, t.bureaus) for t in report.tradelines]


def test_experian_grid():
    text = (
        "         SAMPLE BANK NA          DEMO AUTO              FAKE CARD CO\n"
        "         Inquired on Oct 21, 2026 Inquired on Jul 7, 2026 Inquired on Apr 2, 2026\n"
    )
    report = ParsedReport()
    add_inquiries(report, _doc(text), "EXP")
    assert _names(report) == [
        ("SAMPLE BANK NA", "Oct 21, 2026", ["EXP"]),
        ("DEMO AUTO", "Jul 7, 2026", ["EXP"]),
        ("FAKE CARD CO", "Apr 2, 2026", ["EXP"]),
    ]


def test_named_list_both_shapes():
    text = (
        "Hard inquiries\nHere are the latest hard inquiries on your TransUnion report.\n"
        "DEMO AUTO Mar 3, 2026\n\nSAMPLE BANK\nFeb 28, 2026\nFinance\nCollections\nOTHER Feb 1, 2026\n"
    )
    report = ParsedReport()
    add_inquiries(report, _doc(text), "TUC")
    assert _names(report) == [("DEMO AUTO", "Mar 3, 2026", ["TUC"]), ("SAMPLE BANK", "Feb 28, 2026", ["TUC"])]
    assert all(t.account_type == "Hard Inquiry" and not t.selected for t in report.tradelines)


def test_smartcredit_table():
    text = "Creditor Name Date of Inquiry Credit Bureau\nDEMO AUTO 7/18/2026 Experian\nSAMPLE BK 7/9/2026 TransUnion\nCreditor Contacts\n"
    report = ParsedReport()
    add_inquiries(report, _doc(text), None)
    assert _names(report) == [("DEMO AUTO", "7/18/2026", ["EXP"]), ("SAMPLE BK", "7/9/2026", ["TUC"])]


def test_monitoring_site_cards_use_creditor_information_name():
    text = (
        "Here are the latest hard inquiries on your Equifax report.\n"
        "ol N ‘Oct 7,2025 A\nFinance\nCreditor information\nSAMPLE LENDER\n"
        "DEMO AUTO Nov 1,2026 0.\n‘Creditor information\n\nCreditor information\nDEMO AUTO\n"
        "Show All Inquiries\nDate Opened Mar 13, 2026\n"
    )
    report = ParsedReport()
    add_inquiries(report, _doc(text), "EQF")
    assert _names(report) == [("SAMPLE LENDER", "Oct 7, 2025", ["EQF"]), ("DEMO AUTO", "Nov 1, 2026", ["EQF"])]
