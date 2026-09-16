from __future__ import annotations

CREDIT_FUNDING_BUCKET = "credit-funding-docs"


def pick_letter_identity_docs(docs: list[dict]) -> list[dict]:
    usable = [
        doc
        for doc in docs
        if doc.get("scan_status") != "rejected" and doc.get("storage_path")
    ]
    photo_ids = [doc for doc in usable if doc.get("document_type") == "photo_id"]
    proof = next((doc for doc in usable if doc.get("document_type") == "proof_of_address"), None)
    if proof is None:
        proof = next((doc for doc in usable if doc.get("document_type") == "mail_proof"), None)
    selected = [*photo_ids]
    if proof is not None:
        selected.append(proof)
    return selected


def load_application_enclosure_files(application_uuid: str | None) -> list[tuple[str, bytes]]:
    """Best-effort load of photo ID + proof of address from credit-funding storage."""
    if not application_uuid:
        return []
    try:
        from app.supabase_client import get_supabase

        client = get_supabase()
        result = (
            client.table("uploaded_documents")
            .select("id,document_type,file_name,storage_path,mime_type,scan_status")
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
