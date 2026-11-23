"""Text read in the admin's browser is analyzed without downloading or OCR'ing the file. Fake data."""
from __future__ import annotations

import asyncio

import app.main as main

OCR_TEXT = """SAMPLE BANK $1,200.00
Reported: Oct 21, 2026
Balance: $1,200.00 Credit limit: $3,000.00
DEMO AUTO
Reported: Oct 2, 2026
Balance: $8,400.00
FAKE CARD CO
Reported: Sep 3, 2026
Balance: $0.00 Credit limit: $500.00
"""


def test_browser_text_skips_download_and_ocr(monkeypatch):
    saved = {}
    monkeypatch.setattr(main, "get_session_row", lambda _sid: {"id": "s1"})
    monkeypatch.setattr(main, "set_session_status", lambda *a, **k: None)
    monkeypatch.setattr(main, "update_session_report", lambda sid, report, **k: saved.setdefault("report", report))

    def no_download(*_a, **_k):
        raise AssertionError("file should not be downloaded when the browser sent text")

    monkeypatch.setattr(main, "write_temp_report", no_download)
    monkeypatch.setattr(main, "ingest_file", no_download)

    result = asyncio.run(main._run_analyze_job("s1", "path/x.pdf", "Client Transunion 11-22.pdf", OCR_TEXT))
    assert result["status"] == "complete"
    report = saved["report"]
    assert report.ocr_used
    assert {t.creditor for t in report.tradelines} >= {"SAMPLE BANK", "DEMO AUTO", "FAKE CARD CO"}
    assert all(t.bureaus == ["TUC"] for t in report.tradelines)
