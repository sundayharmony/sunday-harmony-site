"""SDK client shutdown must use aclose, which current cursor-sdk builds expose."""

import asyncio

from app.services.sdk_client_lifecycle import aclose_sdk_client


class _AcloseClient:
    def __init__(self) -> None:
        self.closed = False

    async def aclose(self) -> None:
        self.closed = True

    def close(self) -> None:
        raise AssertionError("close() is not on current AsyncClient")


class _LegacyClient:
    def __init__(self) -> None:
        self.closed = False

    async def close(self) -> None:
        self.closed = True


def test_prefers_aclose_over_missing_close() -> None:
    client = _AcloseClient()
    asyncio.run(aclose_sdk_client(client))
    assert client.closed is True


def test_falls_back_to_close_for_older_clients() -> None:
    client = _LegacyClient()
    asyncio.run(aclose_sdk_client(client))
    assert client.closed is True
