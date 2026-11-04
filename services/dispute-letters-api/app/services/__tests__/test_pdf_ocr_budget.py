"""Scanned PDFs must stop inside a page and time budget."""

from __future__ import annotations

import time
from pathlib import Path

from app.ingest.pdf import (
    DEFAULT_OCR_MAX_PAGES,
    DEFAULT_OCR_MAX_SECONDS,
    _ocr_pdf_budgeted,
    _run_bounded,
)


class _Image:
    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


def _immediate(fn, _timeout):
    return fn()


def test_ocr_defaults_are_bounded():
    assert DEFAULT_OCR_MAX_PAGES <= 8
    assert DEFAULT_OCR_MAX_SECONDS <= 45


def test_ocr_stops_at_page_cap():
    seen: list[int] = []

    def convert(_path, page: int):
        seen.append(page)
        return [_Image()]

    text, used = _ocr_pdf_budgeted(
        Path("scan.pdf"),
        convert_page=convert,
        read_image=lambda _img: "account text",
        max_pages=3,
        max_seconds=100,
        page_timeout=5,
        run_bounded=_immediate,
    )
    assert used is True
    assert seen == [1, 2, 3]
    assert text.count("account text") == 3


def test_ocr_stops_when_wall_clock_budget_is_spent():
    clock = {"t": 0.0}

    def now() -> float:
        return clock["t"]

    def convert(_path, page: int):
        clock["t"] += 15
        return [_Image()]

    text, _used = _ocr_pdf_budgeted(
        Path("scan.pdf"),
        convert_page=convert,
        read_image=lambda _img: "row",
        now=now,
        max_pages=20,
        max_seconds=40,
        page_timeout=5,
        run_bounded=_immediate,
    )
    assert text.count("row") == 3


def test_ocr_stops_when_a_page_times_out():
    calls = {"n": 0}

    def convert(_path, _page: int):
        return [_Image()]

    def bounded(fn, _timeout):
        calls["n"] += 1
        if calls["n"] > 1:
            return None
        return fn()

    text, _used = _ocr_pdf_budgeted(
        Path("scan.pdf"),
        convert_page=convert,
        read_image=lambda _img: "kept",
        max_pages=10,
        max_seconds=100,
        page_timeout=1,
        run_bounded=bounded,
    )
    assert text == "kept"
    assert calls["n"] == 2


def test_ocr_stops_when_conversion_ends():
    def convert(_path, page: int):
        if page == 2:
            raise RuntimeError("no more pages")
        return [_Image()]

    text, _used = _ocr_pdf_budgeted(
        Path("scan.pdf"),
        convert_page=convert,
        read_image=lambda _img: "only",
        max_pages=10,
        max_seconds=100,
        run_bounded=_immediate,
    )
    assert text == "only"


def test_run_bounded_returns_without_waiting_for_the_worker():
    def slow():
        time.sleep(1.0)
        return "late"

    started = time.monotonic()
    assert _run_bounded(slow, 0.15) is None
    assert time.monotonic() - started < 0.6
