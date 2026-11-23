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
# Free Render gets a small share of one CPU: a screenshot report that reads in ~40s
# on a full core needs several minutes there.
DEFAULT_OCR_MAX_SECONDS = 420.0
DEFAULT_OCR_PAGE_TIMEOUT_SEC = 120.0
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

    text = _join_pages(pages_text)
    ocr_used = False
    avg_chars = (len(text) / page_count) if page_count else 0

    if page_count and (avg_chars < 80 or _text_is_junk(text)):
        ocr_text, _ran = _ocr_pdf(path)
        if len(ocr_text) > len(text) or avg_chars < 80:
            text, ocr_used = ocr_text, True
    elif page_count:
        # Browser "Save as PDF" of a monitoring site, or several screenshots
        # combined: some pages have a text layer and some are pictures.
        picture_pages = [n + 1 for n, t in enumerate(pages_text) if len(t.strip()) < 80]
        if picture_pages:
            replaced = False
            for number, page_text in _ocr_pages(path, picture_pages).items():
                if len(page_text.strip()) > len(pages_text[number - 1].strip()):
                    pages_text[number - 1] = page_text
                    replaced = True
            if replaced:
                text, ocr_used = _join_pages(pages_text), True

    return ExtractedDocument(
        file_type="pdf",
        raw_path=str(path),
        text=text,
        html=None,
        page_count=page_count,
        ocr_used=ocr_used,
        extraction_quality=_quality_from_chars(len(text)),
    )


# Headers and footers a browser prints on every page ("11/20/26, 3:14 PM  Title",
# "https://site/page  2/7", "Page 2 of 7"). They land in the middle of an account
# that runs over a page break, so drop them before the pages are joined.
_PRINT_CHROME = re.compile(
    r"(?i)^(?:"
    r"\d{1,2}/\d{1,2}/\d{2,4},?\s+\d{1,2}:?\d{2}\s*(?:[ap]\.?m\.?)?\b.*"
    r"|(?:https?://|www\.|about:blank)\S*(?:\s+\d{1,3}\s*/\s*\d{1,3})?"
    r"|(?:page\s+)?\d{1,3}\s*(?:of|/)\s*\d{1,3}"
    r")$"
)


def strip_print_chrome(page_text: str) -> str:
    lines = (page_text or "").splitlines()
    keep = []
    edge = 3
    for n, line in enumerate(lines):
        near_edge = n < edge or n >= len(lines) - edge
        if near_edge and _PRINT_CHROME.match(line.strip()):
            continue
        keep.append(line)
    return "\n".join(keep)


def _join_pages(pages_text: list[str]) -> str:
    return "\n\n".join(strip_print_chrome(t) for t in pages_text).strip()


def _ocr_pages(path: Path, pages: list[int]) -> dict[int, str]:
    try:
        text_by_page: dict[int, str] = {}
        _ocr_pdf_budgeted(path, pages=pages, out=text_by_page)
        return text_by_page
    except Exception:
        return {}


def _read_rows(read_once, tile) -> str:
    """OCR a tile. Account details on websites sit in label/value rows or two-column
    grids, which tesseract's default mode reads column by column. When the tile holds
    account fields, also read it row by row (psm 4) and keep the reading whose fields
    fall under the right furnisher."""
    from app.services.bureau_text_parser import count_label_lines, layout_score

    first = read_once(tile, 3) or ""
    if count_label_lines(first) < 3:
        return first
    rows = read_once(tile, 4) or ""
    return rows if layout_score(rows) > layout_score(first) else first


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
    pages: list[int] | None = None,
    out: dict[int, str] | None = None,
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
        images = convert_from_path(
            str(pdf_path),
            dpi=dpi,
            first_page=page,
            last_page=page,
            grayscale=True,
        )
        # Pages can differ in size (several screenshots combined into one PDF),
        # so bring each page to the OCR width rather than trusting page 1's DPI.
        return [_to_ocr_width(im) for im in images]

    def _read(img):
        return _read_rows(lambda t, mode: ocr_image_text(t, timeout=limit_page, psm=mode), img)

    convert = convert_page or _convert
    read = read_image or _read
    parts: list[str] = []
    started = clock()
    page_list = list(pages)[:limit_pages] if pages is not None else list(range(1, limit_pages + 1))
    for page in page_list:
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
                    chunk = read(tile) if read_image is not None else bounded(lambda t=tile: read(t), limit_page * 2)
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
        text = strip_print_chrome(text or "")
        parts.append(text)
        if out is not None:
            out[page] = text
    return "\n\n".join(parts).strip(), True


def ocr_image_text(img, *, timeout: float, psm: int = 3) -> str:
    import pytesseract

    config = f"--psm {psm}" if psm != 3 else ""
    return pytesseract.image_to_string(img, timeout=timeout, config=config) or ""


def _to_ocr_width(img):
    """Phone screenshots are narrow and full-page captures wide; both read best near page width."""
    width = getattr(img, "width", 0)
    if not width or not hasattr(img, "resize"):
        return img
    if width < OCR_TARGET_WIDTH_PX * 0.75 or width > OCR_TARGET_WIDTH_PX * 1.3:
        scale = OCR_TARGET_WIDTH_PX / width
        return img.resize((OCR_TARGET_WIDTH_PX, max(1, int(img.height * scale))))
    return img


def ocr_picture(img) -> str:
    """OCR one screenshot: grayscale, scaled to a readable width, tall ones in tiles."""
    _pages, seconds, page_timeout = _ocr_limits()
    started = time.monotonic()
    img = _to_ocr_width(img.convert("L"))
    parts: list[str] = []
    for tile in _tiles(img):
        if parts and time.monotonic() - started >= seconds:
            break
        try:
            chunk = _run_bounded(
                lambda t=tile: _read_rows(lambda im, mode: ocr_image_text(im, timeout=page_timeout, psm=mode), t),
                page_timeout * 2,
            )
        except Exception:
            chunk = None
        if chunk:
            parts.append(chunk)
    return "\n".join(parts).strip()
