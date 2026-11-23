from __future__ import annotations

from pathlib import Path

from app.ingest.pdf import ocr_picture
from app.models import ExtractedDocument


def _quality_from_chars(count: int) -> str:
    if count >= 5000:
        return "high"
    if count >= 1000:
        return "medium"
    return "low"


def extract_image(path: Path, file_type: str) -> ExtractedDocument:
    """OCR a screenshot locally (tesseract). Never sent to an AI service."""
    text = ""
    try:
        from PIL import Image, ImageOps

        with Image.open(path) as opened:
            # Phone photos carry rotation in EXIF; multi-frame files read frame 1.
            img = ImageOps.exif_transpose(opened)
            img.load()
        text = ocr_picture(img)
    except Exception:
        text = ""

    return ExtractedDocument(
        file_type=file_type,
        raw_path=str(path),
        text=text,
        html=None,
        page_count=1,
        ocr_used=True,
        extraction_quality=_quality_from_chars(len(text)),
    )
