from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from pathlib import Path

from app.models import ExtractedDocument

# Scanned PDFs run on a 512MB Render instance. Cap pages and wall time so OCR
# cannot occupy the analyze job for the full client poll window.
DEFAULT_OCR_MAX_PAGES = 8
DEFAULT_OCR_MAX_SECONDS = 40.0
DEFAULT_OCR_PAGE_TIMEOUT_SEC = 8.0


def _quality_from_chars(count: int) -> str:
    if count >= 5000:
        return "high"
    if count >= 1000:
        return "medium"
    return "low"


def extract_pdf(path: Path) -> ExtractedDocument:
    import pdfplumber

    pages_text: list[str] = []
    with pdfplumber.open(path) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            pages_text.append(page.extract_text() or "")

    text = "\n\n".join(pages_text).strip()
    ocr_used = False
    avg_chars = (len(text) / page_count) if page_count else 0

    if page_count and avg_chars < 80:
        text, ocr_used = _ocr_pdf(path)

    return ExtractedDocument(
        file_type="pdf",
        raw_path=str(path),
        text=text,
        html=None,
        page_count=page_count,
        ocr_used=ocr_used,
        extraction_quality=_quality_from_chars(len(text)),
    )


def _ocr_limits() -> tuple[int, float, float]:
    def _float(name: str, default: float) -> float:
        raw = os.environ.get(name, "").strip()
        if not raw:
            return default
        try:
            return float(raw)
        except ValueError:
            return default

    pages = int(_float("DISPUTE_OCR_MAX_PAGES", DEFAULT_OCR_MAX_PAGES))
    seconds = _float("DISPUTE_OCR_MAX_SECONDS", DEFAULT_OCR_MAX_SECONDS)
    page_timeout = _float("DISPUTE_OCR_PAGE_TIMEOUT_SEC", DEFAULT_OCR_PAGE_TIMEOUT_SEC)
    return max(1, pages), max(5.0, seconds), max(1.0, page_timeout)


def _run_bounded(fn, timeout: float):
    """Run fn and abandon it when timeout hits. Do not wait for a stuck worker."""
    pool = ThreadPoolExecutor(max_workers=1)
    future = pool.submit(fn)
    try:
        return future.result(timeout=timeout)
    except FuturesTimeoutError:
        return None
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def _ocr_pdf(path: Path) -> tuple[str, bool]:
    """OCR page-by-page at low DPI, bounded so a scan cannot run for minutes."""
    try:
        return _ocr_pdf_budgeted(path)
    except Exception:
        return "", True


def _ocr_pdf_budgeted(
    path: Path,
    *,
    convert_page=None,
    read_image=None,
    now=None,
    max_pages: int | None = None,
    max_seconds: float | None = None,
    page_timeout: float | None = None,
    run_bounded=None,
) -> tuple[str, bool]:
    import gc

    limit_pages, limit_seconds, limit_page = _ocr_limits()
    if max_pages is not None:
        limit_pages = max_pages
    if max_seconds is not None:
        limit_seconds = max_seconds
    if page_timeout is not None:
        limit_page = page_timeout
    clock = now or time.monotonic
    bounded = run_bounded or _run_bounded

    def _convert(pdf_path, page: int):
        from pdf2image import convert_from_path

        return convert_from_path(
            str(pdf_path),
            dpi=100,
            first_page=page,
            last_page=page,
            grayscale=True,
        )

    def _read(img):
        import pytesseract

        return pytesseract.image_to_string(img, timeout=limit_page) or ""

    convert = convert_page or _convert
    read = read_image or _read
    parts: list[str] = []
    started = clock()
    page = 1
    while page <= limit_pages:
        if clock() - started >= limit_seconds:
            break
        try:
            images = bounded(lambda page=page: convert(path, page), limit_page)
        except Exception:
            break
        if not images:
            break
        img = images[0]
        try:
            text = read(img) if read_image is not None else bounded(lambda img=img: read(img), limit_page)
        except Exception:
            text = None
        finally:
            try:
                img.close()
            except Exception:
                pass
            del img
            del images
            gc.collect()
        if text is None:
            break
        parts.append(text or "")
        page += 1
    return "\n\n".join(parts).strip(), True
