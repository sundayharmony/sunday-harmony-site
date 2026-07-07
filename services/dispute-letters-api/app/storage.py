from __future__ import annotations

import os
from pathlib import Path

from app.config import REPORTS_DIR
from app.supabase_client import DISPUTE_LETTERS_BUCKET, get_supabase


def download_storage_bytes(storage_path: str) -> bytes:
    client = get_supabase()
    data = client.storage.from_(DISPUTE_LETTERS_BUCKET).download(storage_path)
    if isinstance(data, bytes):
        return data
    if hasattr(data, "read"):
        return data.read()
    raise RuntimeError(f"Unexpected download response for {storage_path}")


def upload_storage_bytes(storage_path: str, content: bytes, content_type: str) -> None:
    client = get_supabase()
    result = client.storage.from_(DISPUTE_LETTERS_BUCKET).upload(
        storage_path,
        content,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    if hasattr(result, "error") and result.error:
        raise RuntimeError(str(result.error))


def write_temp_report(storage_path: str, suffix: str) -> Path:
    """Download report from Supabase to a temp file for ingest."""
    content = download_storage_bytes(storage_path)
    dest = REPORTS_DIR / f"tmp_{os.urandom(8).hex()}{suffix}"
    dest.write_bytes(content)
    return dest
