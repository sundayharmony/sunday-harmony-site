from __future__ import annotations

from pathlib import Path

from app.models import ExtractedDocument


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


def _ocr_pdf(path: Path) -> tuple[str, bool]:
    """OCR page-by-page at low DPI to stay within free-tier memory limits."""
    try:
        from pdf2image import convert_from_path
        import pytesseract

        parts: list[str] = []
        # Render free instances are ~512MB; convert one page at a time.
        page = 1
        while True:
            try:
                images = convert_from_path(
                    str(path),
                    dpi=150,
                    first_page=page,
                    last_page=page,
                )
            except Exception:
                break
            if not images:
                break
            img = images[0]
            try:
                parts.append(pytesseract.image_to_string(img) or "")
            finally:
                try:
                    img.close()
                except Exception:
                    pass
            page += 1
            if page > 40:
                break
        return "\n\n".join(parts).strip(), True
    except Exception:
        return "", True
