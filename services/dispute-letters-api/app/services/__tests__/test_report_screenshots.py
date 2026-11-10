"""Select and render disputed-account pages from report PDFs for letter enclosures."""

from __future__ import annotations

from pathlib import Path

from app.models import LetterItem, Tradeline
from app.services.report_screenshots import (
    _SCREENSHOT_CACHE,
    _cache_get,
    _cache_put,
    _screenshot_cache_key,
    account_match_tokens,
    account_number_core,
    disputed_items_from_letter_markdown,
    select_tradeline_account_pages,
    is_score_summary_page,
    page_matches_tokens,
    screenshot_files_for_items,
    select_report_pages_for_items,
)


def test_account_match_tokens_use_creditor_and_account_core():
    tokens = account_match_tokens("ALLY FINANCIAL", "228533XXXXXX")
    assert "ALLY FINANCIAL" in tokens
    assert "ALLY" in tokens
    assert "228533" in tokens


def test_page_match_finds_truncated_equifax_headers():
    page = "DISCOVER C $306.00 Reported: Jun 1, 2026 Account Number 601100XXXXXX"
    assert page_matches_tokens(page, account_match_tokens("DISCOVERCARD", "601100XXXXXX"))


def test_select_pages_for_multiple_disputed_accounts():
    pages = [
        "Cover page scores only Credit Score FICO Summary Your Scores",
        "CAPITAL ONE Account Number 517805XXXXXX Open Reported Status Charge Off",
        "DISCOVERCARD Account Number 601100XXXXXX Late 30 Payment History",
        "ALLY FINANCIAL Account Number 228533XXXXXX Past due Balance: $100 Reported Status Open",
        "VantageScore Score Factor Score Range Bureau Scores",
    ]
    items = [
        LetterItem(tradeline_id="1", creditor="DISCOVERCARD", account_number="601100XXXXXX"),
        LetterItem(tradeline_id="2", creditor="ALLY FINANCIAL", account_number="228533XXXXXX"),
    ]
    assert select_report_pages_for_items(pages, items) == [3, 4]
    assert is_score_summary_page(pages[0])
    assert is_score_summary_page(pages[4])
    assert not is_score_summary_page(pages[2])


def test_fico_whats_hurting_page_is_never_selected():
    fico_page = (
        "experian Prepared For MICHAEL WEBB Date generated: Nov 8, 2026 "
        "FICO Bankcard Score 2 684 Good What's hurting "
        "Serious delinquency You have a serious delinquency (60 days past due or greater) "
        "High credit usage You've made heavy use of your available revolving credit "
        "Many new accounts You've recently opened too many new credit accounts "
        "Bad payment history You have one or more accounts showing missed payments"
    )
    assert is_score_summary_page(fico_page)
    pages = [
        fico_page,
        "GREAT EASTERN RESORT C Account Number 771106XXXXXX Reported Status Collection Balance: $500",
    ]
    items = [
        LetterItem(
            tradeline_id="1",
            creditor="GREAT EASTERN RESORT C",
            account_number="771106XXXXXX",
        )
    ]
    # Must not pick the FICO page even though it mentions past due / accounts.
    assert select_report_pages_for_items(pages, items) == [2]


def test_tradeline_pages_use_bureau_account_and_skip_other_bureaus():
    pages = [
        "FICO What's hurting Account Number 601100XXXXXX past due accounts",
        "Equifax DISCOVER C Account Number 601100XXXXXX Payment History Reported Status",
        "TransUnion ALLY FINANCIAL Account Number 228533XXXXXX Account Type Auto Date Opened",
        "Experian CAPITAL ONE Account Number 517805XXXXXX Reported Status Charge Off",
        "DISCOVERCARD Payment History Reported Status",
    ]
    tradelines = [
        Tradeline(id="disc", creditor="DISCOVERCARD", account_eqf="601100XXXXXX", bureaus=["EQF"]),
        Tradeline(id="ally", creditor="ALLY FINANCIAL", account_tu="228533XXXXXX", bureaus=["TUC"]),
    ]
    rows = select_tradeline_account_pages(pages, tradelines)
    assert {(row["tradeline_id"], row["bureau"], row["page"]) for row in rows} == {
        ("disc", "EQF", 2),
        ("ally", "TUC", 3),
    }
    assert account_number_core("601100XXXXXX") == "601100"


def test_same_account_number_stays_on_the_named_bureau_page():
    pages = [
        "Equifax DISCOVER Account Number 601100XXXXXX Payment History Date Opened",
        "TransUnion DISCOVER Account Number 601100XXXXXX Payment History Date Opened",
    ]
    tradelines = [
        Tradeline(
            id="disc",
            creditor="DISCOVER",
            account_tu="601100XXXXXX",
            account_eqf="601100XXXXXX",
            bureaus=["TUC", "EQF"],
        )
    ]
    rows = select_tradeline_account_pages(pages, tradelines)
    by_bureau = {row["bureau"]: row["page"] for row in rows}
    assert by_bureau == {"EQF": 1, "TUC": 2}


def test_disputed_items_from_letter_markdown():
    markdown = """
Disputed Tradelines

**ALLY FINANCIAL**
Account Number: 228533XXXXXX
Reported Status: Open
Reported Balance: $18,703.00
Basis of Dispute:
Something

**DISCOVERCARD**
Account Number: 601100XXXXXX
Reported Status: Closed
"""
    items = disputed_items_from_letter_markdown(markdown)
    assert [item.creditor for item in items] == ["ALLY FINANCIAL", "DISCOVERCARD"]
    assert items[0].account_number == "228533XXXXXX"


def test_screenshot_files_for_equifax_pdf_when_poppler_available():
    pdf_path = Path(
        "/home/ubuntu/.cursor/projects/agent-repos-sunday-harmony-site/uploads/Equifax_10-7_6c09.pdf"
    )
    if not pdf_path.exists():
        return
    items = [
        LetterItem(tradeline_id="1", creditor="DISCOVER C", account_number="601100XXXXXX"),
        LetterItem(tradeline_id="2", creditor="ALLY", account_number="228533XXXXXX"),
    ]
    files = screenshot_files_for_items(pdf_path.read_bytes(), items, max_pages=4)
    assert files, "expected at least one account evidence JPEG from Equifax PDF"
    assert all(name.startswith("Account Evidence") and data[:2] == b"\xff\xd8" for name, data in files)


def test_screenshot_cache_round_trip():
    _SCREENSHOT_CACHE.clear()
    items = [LetterItem(tradeline_id="1", creditor="ALLY", account_number="1234")]
    key = _screenshot_cache_key("sess", "reports/a.pdf", items)
    assert _cache_get(key) is None
    payload = [("Account Evidence 1.jpg", b"\xff\xd8\xff")]
    _cache_put(key, payload)
    assert _cache_get(key) == payload
    _SCREENSHOT_CACHE.clear()


def test_report_text_cache_reused_across_letters(monkeypatch):
    from app.services import report_screenshots as rs

    rs._REPORT_TEXT_CACHE.clear()
    rs._REPORT_PDF_CACHE.clear()
    rs._PAGE_JPEG_CACHE.clear()
    calls = {"extract": 0, "render": 0}

    def fake_extract(pdf_bytes, *, storage_path=""):
        if storage_path and storage_path in rs._REPORT_TEXT_CACHE:
            return list(rs._REPORT_TEXT_CACHE[storage_path])
        calls["extract"] += 1
        texts = [
            "CAPITAL ONE Account Number 517805XXXXXX Account Type Credit Card",
            "ALLY FINANCIAL Account Number 228533XXXXXX Account Type Auto",
        ]
        if storage_path:
            rs._REPORT_TEXT_CACHE[storage_path] = list(texts)
        return texts

    def fake_render(pdf_bytes, page_numbers, *, dpi=100, storage_path=""):
        calls["render"] += 1
        return [b"\xff\xd8\xff" for _ in page_numbers]

    monkeypatch.setattr(rs, "extract_pdf_page_texts", fake_extract)
    monkeypatch.setattr(rs, "render_pdf_pages_to_jpegs", fake_render)

    pdf = b"%PDF-1.4"
    path = "sessions/s1/report.pdf"
    a = rs.screenshot_files_for_items(
        pdf,
        [LetterItem(tradeline_id="1", creditor="CAPITAL ONE", account_number="517805XXXXXX")],
        storage_path=path,
    )
    b = rs.screenshot_files_for_items(
        pdf,
        [LetterItem(tradeline_id="2", creditor="ALLY FINANCIAL", account_number="228533XXXXXX")],
        storage_path=path,
    )
    assert a and b
    assert calls["extract"] == 1
    assert calls["render"] == 2
