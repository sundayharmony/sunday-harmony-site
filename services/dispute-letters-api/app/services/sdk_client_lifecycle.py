"""Close a Cursor SDK client without assuming a particular method name."""

from __future__ import annotations

from typing import Any


async def aclose_sdk_client(client: Any) -> None:
    """Close an SDK client. Current builds expose ``aclose``; older ones used ``close``."""
    closer = getattr(client, "aclose", None)
    if closer is None:
        closer = getattr(client, "close", None)
    if closer is None:
        return
    result = closer()
    if hasattr(result, "__await__"):
        await result
