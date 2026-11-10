"""Save disputed-account page images once, while the report is analyzed."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from app.models import ParsedReport

logger = logging.getLogger(__name__)

_SESSION_ID = re.compile(r"^[0-9a-fA-F-]{36}$")
_DEFAULT_DPI = 100


def evidence_manifest_path(session_id: str) -> str:
    if not _SESSION_ID.match(session_id or ""):
        raise ValueError("invalid session")
    return f"sessions/{session_id}/evidence/manifest.json"


def evidence_page_path(session_id: str, page: int) -> str:
    if not _SESSION_ID.match(session_id or "") or page < 1:
        raise ValueError("invalid evidence page")
    return f"sessions/{session_id}/evidence/page-{page}.jpg"


def render_pdf_file_pages(pdf_path: str, page_numbers: list[int], *, dpi: int = _DEFAULT_DPI) -> dict[int, bytes]:
    """Render selected pages from a local PDF. One Poppler call per page, file already on disk."""
    if not pdf_path or not page_numbers:
        return {}
    try:
        from pdf2image import convert_from_path
    except Exception:
        return {}

    images: dict[int, bytes] = {}
    for page_no in page_numbers:
        try:
            rendered = convert_from_path(
                pdf_path,
                dpi=dpi,
                fmt="jpeg",
                first_page=page_no,
                last_page=page_no,
                thread_count=1,
            )
        except Exception:
            continue
        if not rendered:
            continue
        from io import BytesIO

        buf = BytesIO()
        rendered[0].convert("RGB").save(buf, format="JPEG", quality=75)
        jpeg = buf.getvalue()
        if jpeg[:2] == b"\xff\xd8":
            images[page_no] = jpeg
    return images


def read_account_evidence_manifest(session_id: str) -> dict | None:
    try:
        from app.storage import download_storage_bytes

        raw = download_storage_bytes(evidence_manifest_path(session_id))
        parsed = json.loads(raw.decode("utf-8"))
    except Exception:
        return None
    if not isinstance(parsed, dict) or parsed.get("attempted") is not True:
        return None
    return parsed


def _upload_bytes(path: str, content: bytes, content_type: str, upload=None) -> None:
    if upload is not None:
        upload(path, content, content_type)
        return
    from app.storage import upload_storage_bytes

    upload_storage_bytes(path, content, content_type)


def _write_manifest(session_id: str, manifest: dict, upload=None) -> None:
    _upload_bytes(
        evidence_manifest_path(session_id),
        json.dumps(manifest).encode("utf-8"),
        "application/json",
        upload,
    )


def record_account_evidence_attempt(session_id: str, *, missing: bool, upload=None) -> dict:
    manifest = {"attempted": True, "missing": missing, "pages": []}
    try:
        _write_manifest(session_id, manifest, upload)
    except Exception:
        logger.warning("account evidence manifest was not saved", exc_info=True)
    return manifest


def store_account_evidence(
    session_id: str,
    report: ParsedReport,
    pdf_path: str,
    page_texts: list[str] | None,
    *,
    render_pages=None,
    upload=None,
) -> dict:
    """Match account pages, save one JPEG per page, and record the attempt.

    A render or upload failure still writes a manifest so later ZIP builds do not
    start this work again.
    """
    from app.services.report_screenshots import select_tradeline_account_pages

    try:
        texts = list(page_texts or [])
        if not texts and pdf_path:
            from app.ingest.pdf import extract_pdf

            texts = list(extract_pdf(Path(pdf_path)).pages or [])
        matches = select_tradeline_account_pages(texts, list(report.tradelines or []))
        unique_pages = []
        for match in matches:
            if match["page"] not in unique_pages:
                unique_pages.append(match["page"])
        render = render_pages or render_pdf_file_pages
        jpegs = render(pdf_path, unique_pages) if unique_pages and pdf_path else {}
        if not isinstance(jpegs, dict):
            jpegs = {}
        uploaded: set[int] = set()
        stored: list[dict] = []
        for match in matches:
            page_no = int(match["page"])
            jpeg = jpegs.get(page_no)
            if not jpeg:
                continue
            path = evidence_page_path(session_id, page_no)
            if page_no not in uploaded:
                _upload_bytes(path, jpeg, "image/jpeg", upload)
                uploaded.add(page_no)
            stored.append(
                {
                    "page": page_no,
                    "bureau": match["bureau"],
                    "tradeline_id": match["tradeline_id"],
                    "path": path,
                    "account": match["account"],
                }
            )
        manifest = {
            "attempted": True,
            "missing": bool(matches) and not stored,
            "pages": stored,
        }
        _write_manifest(session_id, manifest, upload)
        return manifest
    except Exception:
        logger.warning("account evidence store failed", exc_info=True)
        return record_account_evidence_attempt(session_id, missing=True, upload=upload)


def ensure_account_evidence(session_id: str) -> dict | None:
    """Store images for a report analyzed before this step existed. No-op when a manifest is already saved."""
    if not _SESSION_ID.match(session_id or ""):
        return None
    existing = read_account_evidence_manifest(session_id)
    if existing is not None:
        return existing
    temp: Path | None = None
    try:
        from app.db import get_session
        from app.ingest.pdf import extract_pdf
        from app.storage import write_temp_report

        loaded = get_session(session_id)
        if not loaded:
            return record_account_evidence_attempt(session_id, missing=True)
        storage_path, _file_type, report = loaded
        if not (storage_path or "").lower().endswith(".pdf"):
            return record_account_evidence_attempt(session_id, missing=False)
        temp = write_temp_report(storage_path, ".pdf")
        doc = extract_pdf(temp)
        return store_account_evidence(session_id, report, str(temp), list(doc.pages or []))
    except Exception:
        logger.warning("account evidence backfill failed", exc_info=True)
        return record_account_evidence_attempt(session_id, missing=True)
    finally:
        if temp and temp.exists():
            try:
                temp.unlink()
            except OSError:
                pass
