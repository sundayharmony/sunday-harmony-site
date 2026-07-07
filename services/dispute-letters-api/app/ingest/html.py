from __future__ import annotations

from pathlib import Path

from app.models import ExtractedDocument


def _quality_from_chars(count: int) -> str:
    if count >= 5000:
        return "high"
    if count >= 1000:
        return "medium"
    return "low"


def extract_html(path: Path) -> ExtractedDocument:
    text = path.read_text(encoding="utf-8", errors="replace")
    return ExtractedDocument(
        file_type="html",
        raw_path=str(path),
        text=text,
        html=text,
        ocr_used=False,
        extraction_quality=_quality_from_chars(len(text)),
    )
