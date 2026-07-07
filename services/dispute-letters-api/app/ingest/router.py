from __future__ import annotations

from pathlib import Path

from app.ingest.doc import extract_doc
from app.ingest.docx import extract_docx
from app.ingest.html import extract_html
from app.ingest.image import extract_image
from app.ingest.pdf import extract_pdf
from app.ingest.txt import extract_txt
from app.models import ExtractedDocument

EXTENSION_MAP = {
    ".html": "html",
    ".htm": "html",
    ".txt": "txt",
    ".pdf": "pdf",
    ".docx": "docx",
    ".doc": "doc",
    ".png": "png",
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
}


def detect_file_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext not in EXTENSION_MAP:
        raise ValueError(f"Unsupported file type: {ext}")
    return EXTENSION_MAP[ext]


def ingest_file(path: Path) -> ExtractedDocument:
    file_type = detect_file_type(path)
    if file_type == "html":
        return extract_html(path)
    if file_type == "txt":
        return extract_txt(path)
    if file_type == "pdf":
        return extract_pdf(path)
    if file_type == "docx":
        return extract_docx(path)
    if file_type == "doc":
        return extract_doc(path)
    if file_type in ("png", "jpeg"):
        return extract_image(path, file_type)
    raise ValueError(f"No ingest handler for {file_type}")
