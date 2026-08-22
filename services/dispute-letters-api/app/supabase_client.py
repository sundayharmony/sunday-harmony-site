from __future__ import annotations

import os
import re
from functools import lru_cache
from urllib.parse import urlparse

from supabase import Client, create_client


def _clean_env(value: str) -> str:
    """Strip whitespace and accidental surrounding quotes from dashboard pastes."""
    cleaned = (value or "").strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in ("'", '"'):
        cleaned = cleaned[1:-1].strip()
    # Remove zero-width / BOM characters that break httpx URL parsing.
    cleaned = cleaned.replace("\ufeff", "").replace("\u200b", "")
    return cleaned


def _supabase_url() -> str:
    return _clean_env(
        os.environ.get("SUPABASE_URL", "")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    )


def _supabase_key() -> str:
    return _clean_env(
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.environ.get("SUPABASE_SECRET_KEY", "")
    )


def supabase_env_configured() -> bool:
    return bool(_supabase_url() and _supabase_key())


def _validate_supabase_url(url: str) -> str | None:
    if not url:
        return "SUPABASE_URL is empty"
    if any(ch.isspace() for ch in url):
        return "SUPABASE_URL contains whitespace — re-paste it in Render with no spaces or quotes"
    if not url.startswith("https://"):
        return "SUPABASE_URL must start with https://"
    try:
        parsed = urlparse(url)
    except Exception:
        return "SUPABASE_URL could not be parsed"
    if not parsed.netloc or "supabase.co" not in parsed.netloc:
        return (
            "SUPABASE_URL host looks wrong — expected https://<project-ref>.supabase.co "
            f"(got host {parsed.netloc!r})"
        )
    if parsed.path not in ("", "/"):
        return "SUPABASE_URL should be the project root only (no /rest/v1 path)"
    return None


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
    url_error = _validate_supabase_url(url)
    if url_error:
        raise RuntimeError(url_error)
    if not re.match(r"^(eyJ|[a-z]{2}_)", key):
        # eyJ… = legacy JWT service role; sb_secret_… / similar = new secret key formats
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY does not look like a Supabase secret key. "
            "Paste the service_role key from Supabase → Settings → API (no quotes)."
        )
    try:
        return create_client(url, key)
    except Exception as e:
        raise RuntimeError(
            f"Could not create Supabase client ({e}). "
            "In Render Environment, re-save SUPABASE_URL as https://<ref>.supabase.co "
            "with no quotes, then Manual Deploy."
        ) from e


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
    url = _supabase_url()
    url_error = _validate_supabase_url(url)
    if url_error:
        return {
            "ok": False,
            "error": url_error,
            "url_host": urlparse(url).netloc if url.startswith("http") else None,
            "url_length": len(url),
        }
    try:
        # Clear cached client so env edits after boot are picked up on next ping/analyze.
        get_supabase.cache_clear()
        client = get_supabase()
        client.table("dispute_sessions").select("id").limit(1).execute()
        return {"ok": True, "url_host": urlparse(url).netloc}
    except Exception as e:
        msg = str(e).strip() or e.__class__.__name__
        if re.search(r"invalid url", msg, re.I):
            msg = (
                "Invalid URL talking to Supabase — usually SUPABASE_URL was pasted with "
                "quotes or a hidden character in Render. Delete SUPABASE_URL, re-add it as "
                "https://hvsoeezsbvwsrdobvgaz.supabase.co (no quotes), save, Manual Deploy."
            )
        return {
            "ok": False,
            "error": msg[:400],
            "url_host": urlparse(url).netloc,
            "url_length": len(url),
        }


DISPUTE_LETTERS_BUCKET = "dispute-letters"
