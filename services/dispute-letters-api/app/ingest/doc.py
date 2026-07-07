from __future__ import annotations

from pathlib import Path

from app.models import ExtractedDocument


def _quality_from_chars(count: int) -> str:
    if count >= 5000:
        return "high"
    if count >= 1000:
        return "medium"
    return "low"


def extract_doc(path: Path) -> ExtractedDocument:
    import mammoth

    with open(path, "rb") as f:
        result = mammoth.extract_raw_text(f)
    text = (result.value or "").strip()
    return ExtractedDocument(
        file_type="doc",
        raw_path=str(path),
        text=text,
        html=None,
        ocr_used=False,
        extraction_quality=_quality_from_chars(len(text)),
    )
