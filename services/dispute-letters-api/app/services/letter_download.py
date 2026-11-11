"""Assemble enclosure files for letter PDF/DOCX downloads."""

from __future__ import annotations

from app.services.letter_identity import load_application_enclosure_files


def letter_files_for_download(
    session_id: str,
    letter,
    uploaded: list[tuple[str, bytes]] | None = None,
    *,
    include_evidence: bool = False,
    application_uuid: str | None = None,
) -> list[tuple[str, bytes]]:
    """Identity documents only. Account-page screenshots are not attached."""
    del session_id, letter, include_evidence
    files: list[tuple[str, bytes]] = list(uploaded or [])
    if not files and application_uuid is not None:
        files = load_application_enclosure_files(application_uuid)
    return files
