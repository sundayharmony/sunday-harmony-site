from __future__ import annotations

import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from pathlib import Path

from app.models import ExtractedDocument

# Scanned PDFs run on a 512MB Render instance. Cap pages and wall time so OCR
# cannot run forever. Browser "full page capture" PDFs have pages ~20,000px tall,
# so each page is scaled to a fixed width and read in tiles; a tile is the unit
# the per-call timeout applies to.
DEFAULT_OCR_MAX_PAGES = 40
DEFAULT_OCR_MAX_SECONDS = 150.0
DEFAULT_OCR_PAGE_TIMEOUT_SEC = 20.0
OCR_TARGET_WIDTH_PX = 1700
OCR_MAX_DPI = 200
OCR_TILE_HEIGHT_PX = 2200
OCR_TILE_OVERLAP_PX = 60


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

    if page_count and (avg_chars < 80 or _text_is_junk(text)):
        ocr_text, _ran = _ocr_pdf(path)
        if len(ocr_text) > len(text) or avg_chars < 80:
            text, ocr_used = ocr_text, True

    return ExtractedDocument(
        file_type="pdf",
        raw_path=str(path),
        text=text,
        html=None,
        page_count=page_count,
        ocr_used=ocr_used,
        extraction_quality=_quality_from_chars(len(text)),
    )


def _text_is_junk(text: str) -> bool:
    """Some PDFs embed fonts that map to digits/symbols, so the text layer is noise."""
    # "(cid:12)" is how pdfplumber prints glyphs it cannot map to letters.
    chars = [c for c in re.sub(r"\(cid:\d+\)", "#", text or "") if not c.isspace()]
    if len(chars) < 200:
        return False
    letters = sum(1 for c in chars if c.isalpha())
    return letters / len(chars) < 0.35


def _tiles(img):
    """Split a tall page image into overlapping horizontal strips."""
    height = getattr(img, "height", 0)
    if not height or height <= OCR_TILE_HEIGHT_PX + OCR_TILE_OVERLAP_PX or not hasattr(img, "crop"):
        return [img]
    return [
        img.crop((0, top, img.width, min(height, top + OCR_TILE_HEIGHT_PX + OCR_TILE_OVERLAP_PX)))
        for top in range(0, height, OCR_TILE_HEIGHT_PX)
    ]


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
        from pdf2image import convert_from_path, pdfinfo_from_path

        dpi = 100
        try:
            width_pt = float(str(pdfinfo_from_path(str(pdf_path)).get("Page size", "")).split()[0])
            dpi = max(50, min(OCR_MAX_DPI, int(OCR_TARGET_WIDTH_PX / (width_pt / 72))))
        except (ValueError, IndexError, Exception):
            pass
        return convert_from_path(
            str(pdf_path),
            dpi=dpi,
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
        page_parts: list[str] = []
        try:
            for tile in _tiles(img):
                if page_parts and clock() - started >= limit_seconds:
                    break
                try:
                    chunk = read(tile) if read_image is not None else bounded(lambda t=tile: read(t), limit_page)
                except Exception:
                    chunk = None
                if chunk:
                    page_parts.append(chunk)
            text = "\n".join(page_parts) if page_parts else None
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
