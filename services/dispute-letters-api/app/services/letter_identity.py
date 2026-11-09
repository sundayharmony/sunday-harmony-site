from __future__ import annotations

import re

CREDIT_FUNDING_BUCKET = "credit-funding-docs"

LETTER_WORKING_COPY_NAME_RE = re.compile(
    r"^letter-current_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_",
    re.I,
)


def _object_name(storage_path: str | None) -> str:
    return (storage_path or "").rsplit("/", 1)[-1]


def is_letter_working_copy_path(storage_path: str | None) -> bool:
    return bool(LETTER_WORKING_COPY_NAME_RE.match(_object_name(storage_path)))


def letter_working_copy_original_id(storage_path: str | None) -> str | None:
    match = LETTER_WORKING_COPY_NAME_RE.match(_object_name(storage_path))
    return match.group(1).lower() if match else None


def _resolve_docs_for_type(usable: list[dict], document_type: str) -> list[dict]:
    """Prefer letter working copies over originals when staff cropped an ID for mail."""
    of_type = [doc for doc in usable if doc.get("document_type") == document_type]
    originals = [doc for doc in of_type if not is_letter_working_copy_path(doc.get("storage_path"))]
    copies = [doc for doc in of_type if is_letter_working_copy_path(doc.get("storage_path"))]
    resolved: list[dict] = []
    used_copy_ids: set[str] = set()

    for original in originals:
        original_id = str(original.get("id") or "").lower()
        matching = [
            copy
            for copy in copies
            if letter_working_copy_original_id(copy.get("storage_path")) == original_id
        ]
        if matching:
            # Newest first when created_at is present; otherwise first match.
            matching.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
            copy = matching[0]
            resolved.append(copy)
            used_copy_ids.add(str(copy.get("id") or ""))
        else:
            resolved.append(original)

    for copy in copies:
        copy_id = str(copy.get("id") or "")
        if copy_id in used_copy_ids:
            continue
        original_id = letter_working_copy_original_id(copy.get("storage_path"))
        if original_id and any(str(doc.get("id") or "").lower() == original_id for doc in originals):
            continue
        resolved.append(copy)

    return resolved


def pick_letter_identity_docs(docs: list[dict]) -> list[dict]:
    """Photo ID(s) + proof of address + SSN card, preferring letter working copies."""
    usable = [
        doc
        for doc in docs
        if doc.get("scan_status") != "rejected" and doc.get("storage_path")
    ]
    photo_ids = _resolve_docs_for_type(usable, "photo_id")
    proof = _resolve_docs_for_type(usable, "proof_of_address")
    if not proof:
        proof = _resolve_docs_for_type(usable, "mail_proof")
    ssn = _resolve_docs_for_type(usable, "ssn_card")
    selected = [*photo_ids]
    if proof:
        selected.append(proof[0])
    if ssn:
        selected.append(ssn[0])
    return selected


def load_application_enclosure_files(application_uuid: str | None) -> list[tuple[str, bytes]]:
    """Best-effort load of photo ID + proof of address + SSN from credit-funding storage."""
    if not application_uuid:
        return []
    try:
        from app.supabase_client import get_supabase

        client = get_supabase()
        result = (
            client.table("uploaded_documents")
            .select("id,document_type,file_name,storage_path,mime_type,scan_status,created_at")
            .eq("application_uuid", application_uuid)
            .order("created_at", desc=False)
            .execute()
        )
        docs = pick_letter_identity_docs(result.data or [])
        files: list[tuple[str, bytes]] = []
        for doc in docs:
            path = doc.get("storage_path") or ""
            data = client.storage.from_(CREDIT_FUNDING_BUCKET).download(path)
            if hasattr(data, "read"):
                data = data.read()
            if not isinstance(data, (bytes, bytearray)) or not data:
                continue
            name = doc.get("file_name") or path.rsplit("/", 1)[-1] or "enclosure.bin"
            files.append((str(name), bytes(data)))
        return files
    except Exception:
        return []
