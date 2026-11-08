"""Select and render disputed-account pages from report PDFs for letter enclosures."""

from __future__ import annotations

from pathlib import Path

from app.models import LetterItem
from app.services.report_screenshots import (
    account_match_tokens,
    disputed_items_from_letter_markdown,
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
        "Cover page scores only",
        "CAPITAL ONE Account Number 517805XXXXXX Open",
        "DISCOVERCARD Account Number 601100XXXXXX Late 30",
        "ALLY FINANCIAL Account Number 228533XXXXXX Past due",
    ]
    items = [
        LetterItem(tradeline_id="1", creditor="DISCOVERCARD", account_number="601100XXXXXX"),
        LetterItem(tradeline_id="2", creditor="ALLY FINANCIAL", account_number="228533XXXXXX"),
    ]
    assert select_report_pages_for_items(pages, items) == [3, 4]


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
