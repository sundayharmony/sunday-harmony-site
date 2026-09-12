"""Pure helpers for letter-generation job outcomes (no DB / FastAPI)."""

from __future__ import annotations

from typing import Any


def empty_letters_error(skipped: list[dict[str, Any]]) -> str:
    if skipped:
        names = ", ".join(
            str(item.get("recipient_name") or "furnisher") for item in skipped
        )
        return f"No letters generated. Address needed for: {names}."
    return "No letters were generated."
