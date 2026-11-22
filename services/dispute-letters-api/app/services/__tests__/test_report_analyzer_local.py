"""Report analysis runs locally; no report text leaves the service."""

from __future__ import annotations

import asyncio

from app.models import ExtractedDocument, ParsedReport, Tradeline
from app.services.report_analyzer import (
    analyze_report_async,
    real_account_count,
)

EXPERIAN_TEXT = """
Prepared For JANE Q PUBLIC Date generated: Sep 11, 2026
Experian
Account info
Account name NORTHWIND AUTO FINANCE Balance $8,430
Account number 481200009999 Balance updated Aug 11, 2026
Account type Auto Loan Past due amount $8,430
Date opened May 2, 2019 Terms 72 Months
Open/Closed Closed Responsibility Individual
Status Repossession. $8,430 past Your statement -
due as of Aug 2026
Payment history
"""

NARRATIVE = (
    "This handbook explains how credit scores are calculated for consumers in general. "
    "It does not list furnisher accounts, balances, or statuses."
)

IDENTITYIQ_HTML = """
<html><body>
  <div>IdentityIQ Credit Report</div>
  <div class="sub_header ng-binding">NORTH STAR BANK</div>
  <table class="rpt_content_table rpt_table4column">
    <tr>
      <th class="label"></th>
      <th class="headerEXP">Experian</th>
    </tr>
    <tr>
      <td class="label">Account #:</td>
      <td class="info">****1111</td>
    </tr>
    <tr>
      <td class="label">Account Status:</td>
      <td class="info">Collection</td>
    </tr>
    <tr>
      <td class="label">Balance:</td>
      <td class="info">$200</td>
    </tr>
    <tr>
      <td class="label">Account Type - Detail:</td>
      <td class="info">Collection</td>
    </tr>
  </table>
</body></html>
"""


def _doc(text: str, *, html: str | None = None, file_type: str = "pdf") -> ExtractedDocument:
    return ExtractedDocument(
        file_type=file_type,
        raw_path="",
        text=html or text,
        html=html,
        ocr_used=False,
        extraction_quality="high",
    )


def _accounts(n: int, prefix: str, *, inquiry: bool = False) -> ParsedReport:
    tradelines = []
    for index in range(n):
        tradelines.append(
            Tradeline(
                id=f"{prefix}-{index}",
                creditor=f"{prefix} {index}",
                status="Inquiry" if inquiry else "Collection",
                account_type="Inquiry" if inquiry else "Collection",
                balance="" if inquiry else "$25",
                bureaus=["EXP"],
                account_exp="" if inquiry else f"100{index}",
            )
        )
    return ParsedReport(source="fallback_parser", tradelines=tradelines)


def test_inquiries_do_not_count_as_real_accounts():
    assert real_account_count(_accounts(2, "Shop", inquiry=True)) == 0


def test_experian_text_parses_locally():
    report = asyncio.run(
        analyze_report_async(
            _doc(EXPERIAN_TEXT),
            file_name="Jane Public Experian.pdf",
        )
    )
    assert [tl.creditor for tl in report.tradelines] == ["NORTHWIND AUTO FINANCE"]
    assert report.source == "fallback_parser"
    assert "locally" in report.analysis_summary.lower()
    assert "failed" not in report.analysis_summary.lower()
    assert report.tradelines[0].selected is True


def test_identityiq_html_parses_locally():
    report = asyncio.run(
        analyze_report_async(
            _doc(IDENTITYIQ_HTML, html=IDENTITYIQ_HTML, file_type="html"),
            file_name="identityiq.html",
        )
    )
    assert [tl.creditor for tl in report.tradelines] == ["NORTH STAR BANK"]
    assert report.tradelines[0].account_exp == "****1111"


def test_empty_local_parse_returns_no_accounts():
    report = asyncio.run(analyze_report_async(_doc(NARRATIVE), file_name="mystery.pdf"))
    assert report.tradelines == []
    assert "known report layout" in report.analysis_summary
