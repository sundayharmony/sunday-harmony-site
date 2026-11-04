"""Local analysis finalizes before the Cursor agent, and the agent is one short try."""

from __future__ import annotations

import asyncio

from app.models import ExtractedDocument, ParsedReport, Tradeline
from app.services.report_analyzer import (
    DEFAULT_AGENT_TIMEOUT_SEC,
    _agent_timeout_sec,
    analyze_report_async,
    prefer_richer_report,
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


def test_prefer_richer_report_keeps_local_when_agent_has_fewer_accounts():
    local = _accounts(3, "Local")
    agent = _accounts(1, "Agent")
    chosen, health = prefer_richer_report(local, agent, {"repair_summary": "thin"})
    assert real_account_count(chosen) == 3
    assert chosen.tradelines[0].creditor.startswith("Local")
    assert health is None


def test_prefer_richer_report_uses_agent_when_it_finds_more_accounts():
    local = _accounts(0, "Local")
    agent = _accounts(2, "Agent")
    chosen, health = prefer_richer_report(local, agent, {"repair_summary": "full"})
    assert [tl.creditor for tl in chosen.tradelines] == ["Agent 0", "Agent 1"]
    assert health == {"repair_summary": "full"}


def test_inquiries_do_not_count_as_real_accounts():
    assert real_account_count(_accounts(2, "Shop", inquiry=True)) == 0


def test_agent_timeout_defaults_to_one_short_attempt(monkeypatch):
    monkeypatch.delenv("CURSOR_ANALYZE_TIMEOUT_SEC", raising=False)
    assert DEFAULT_AGENT_TIMEOUT_SEC <= 30
    assert _agent_timeout_sec() == DEFAULT_AGENT_TIMEOUT_SEC
    monkeypatch.setenv("CURSOR_ANALYZE_TIMEOUT_SEC", "12")
    assert _agent_timeout_sec() == 12


def test_experian_text_skips_the_agent(monkeypatch):
    calls: list[bool] = []

    async def _agent(*_args, **_kwargs):
        calls.append(True)
        raise AssertionError("agent should not run when local accounts exist")

    monkeypatch.setenv("CURSOR_API_KEY", "test-key")
    monkeypatch.setattr("app.services.report_analyzer._analyze_via_agent", _agent)
    report = asyncio.run(
        analyze_report_async(
            _doc(EXPERIAN_TEXT),
            file_name="Jane Public Experian.pdf",
        )
    )
    assert calls == []
    assert [tl.creditor for tl in report.tradelines] == ["NORTHWIND AUTO FINANCE"]
    assert report.source == "fallback_parser"
    assert "locally" in report.analysis_summary.lower()
    assert "failed" not in report.analysis_summary.lower()
    assert report.tradelines[0].selected is True


def test_identityiq_html_skips_the_agent(monkeypatch):
    calls: list[bool] = []

    async def _agent(*_args, **_kwargs):
        calls.append(True)
        raise AssertionError("structured reports should not wait on the agent")

    monkeypatch.setenv("CURSOR_API_KEY", "test-key")
    monkeypatch.setattr("app.services.report_analyzer._analyze_via_agent", _agent)
    report = asyncio.run(
        analyze_report_async(
            _doc(IDENTITYIQ_HTML, html=IDENTITYIQ_HTML, file_type="html"),
            file_name="identityiq.html",
        )
    )
    assert calls == []
    assert [tl.creditor for tl in report.tradelines] == ["NORTH STAR BANK"]
    assert report.tradelines[0].account_exp == "****1111"


def test_agent_is_called_once_when_local_parse_has_no_accounts(monkeypatch):
    calls: list[bool] = []

    async def _agent(_doc, _text, retry_strict: bool = False):
        calls.append(retry_strict)
        raise RuntimeError("boom")

    monkeypatch.setenv("CURSOR_API_KEY", "test-key")
    monkeypatch.setenv("CURSOR_ANALYZE_AGENT", "1")
    monkeypatch.setattr("app.services.report_analyzer._analyze_via_agent", _agent)
    report = asyncio.run(analyze_report_async(_doc(NARRATIVE), file_name="notes.pdf"))
    assert calls == [False]
    assert report.tradelines == []
    assert "Agent analysis failed" in report.analysis_summary
    assert "boom" in report.analysis_summary


def test_agent_result_is_kept_when_local_parse_is_empty(monkeypatch):
    async def _agent(_doc, _text, retry_strict: bool = False):
        assert retry_strict is False
        return (
            ParsedReport(
                source="cursor_agent",
                analysis_summary="from agent",
                tradelines=[
                    Tradeline(
                        id="agent-1",
                        creditor="AGENT BANK",
                        status="Collection",
                        account_type="Collection",
                        balance="$80",
                        bureaus=["EXP"],
                        account_exp="99990000",
                    )
                ],
            ),
            {"repair_summary": "agent health"},
        )

    monkeypatch.setenv("CURSOR_API_KEY", "test-key")
    monkeypatch.setenv("CURSOR_ANALYZE_AGENT", "1")
    monkeypatch.setattr("app.services.report_analyzer._analyze_via_agent", _agent)
    report = asyncio.run(analyze_report_async(_doc(NARRATIVE), file_name="mystery.pdf"))
    assert [tl.creditor for tl in report.tradelines] == ["AGENT BANK"]
    assert report.source == "cursor_agent"


def test_empty_local_parse_does_not_call_the_agent_by_default(monkeypatch):
    calls: list[bool] = []

    async def _agent(*_args, **_kwargs):
        calls.append(True)
        raise AssertionError("agent should stay off unless CURSOR_ANALYZE_AGENT is set")

    monkeypatch.setenv("CURSOR_API_KEY", "test-key")
    monkeypatch.delenv("CURSOR_ANALYZE_AGENT", raising=False)
    monkeypatch.setattr("app.services.report_analyzer._analyze_via_agent", _agent)
    report = asyncio.run(analyze_report_async(_doc(NARRATIVE), file_name="mystery.pdf"))
    assert calls == []
    assert report.tradelines == []
    assert "known report layout" in report.analysis_summary
