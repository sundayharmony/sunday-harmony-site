from __future__ import annotations

import os
from functools import lru_cache

from supabase import Client, create_client


def supabase_env_configured() -> bool:
    url = (
        os.environ.get("SUPABASE_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    )
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    )
    return bool(url and key)


def _supabase_url() -> str:
    return (
        os.environ.get("SUPABASE_URL", "").strip()
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    )


def _supabase_key() -> str:
    return (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    )


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = _supabase_url()
    key = _supabase_key()
    if not url or not key:
        raise RuntimeError(
            "Supabase is not configured on the analysis API. "
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) "
            "on the Render service to the same values used by Vercel, then redeploy."
        )
    return create_client(url, key)


def ping_supabase() -> dict:
    """Lightweight connectivity check used by /config and /ready."""
    if not supabase_env_configured():
        return {
            "ok": False,
            "error": (
                "Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY "
                "(or SUPABASE_SECRET_KEY) on this service."
            ),
        }
    try:
        client = get_supabase()
        # Head-style select — validates URL + key without depending on row data.
        client.table("dispute_sessions").select("id").limit(1).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}


DISPUTE_LETTERS_BUCKET = "dispute-letters"
