from __future__ import annotations

from app.models import ParsedReport


def can_parse(html: str) -> bool:
    lower = html.lower()
    return "smartcredit" in lower or "consumerdirect" in lower


def parse(html: str, file_type: str = "html", ocr_used: bool = False, quality: str = "medium") -> ParsedReport:
    """Fallback-only SmartCredit parser stub. Primary analysis uses the Cursor agent."""
    raise NotImplementedError(
        "SmartCredit HTML fallback parser is not yet implemented. "
        "Provide a SmartCredit HTML sample to enable fallback parsing when the agent is unavailable."
    )
