"""Assemble enclosure files for letter PDF/DOCX downloads."""

from __future__ import annotations

from app.services.letter_identity import load_application_enclosure_files
from app.services.report_screenshots import load_report_account_screenshot_files


def letter_files_for_download(
    session_id: str,
    letter,
    uploaded: list[tuple[str, bytes]] | None = None,
    *,
    include_evidence: bool = True,
    application_uuid: str | None = None,
) -> list[tuple[str, bytes]]:
    """Identity docs always; account screenshots only when include_evidence is true.

    Interactive single-letter downloads set include_evidence=False so Next.js stays
    under Vercel function timeouts. ZIP / package builds keep evidence on.
    """
    files: list[tuple[str, bytes]] = list(uploaded or [])
    if not files and application_uuid is not None:
        files = load_application_enclosure_files(application_uuid)
    if include_evidence:
        files.extend(load_report_account_screenshot_files(session_id, letter))
    return files
