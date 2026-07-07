from __future__ import annotations

from pathlib import Path

from app.models import ExtractedDocument


def _quality_from_chars(count: int) -> str:
    if count >= 5000:
        return "high"
    if count >= 1000:
        return "medium"
    return "low"


def extract_image(path: Path, file_type: str) -> ExtractedDocument:
    try:
        import pytesseract
        from PIL import Image

        text = pytesseract.image_to_string(Image.open(path)).strip()
        ocr_used = True
    except Exception:
        text = ""
        ocr_used = True

    return ExtractedDocument(
        file_type=file_type,
        raw_path=str(path),
        text=text,
        html=None,
        page_count=1,
        ocr_used=ocr_used,
        extraction_quality=_quality_from_chars(len(text)),
    )
