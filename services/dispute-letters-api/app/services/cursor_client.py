from __future__ import annotations

import asyncio
import concurrent.futures
import os
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from app.config import PROJECT_ROOT
from cursor_sdk import AgentOptions, LocalAgentOptions
from cursor_sdk.asyncio import AsyncAgent, AsyncClient

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


def _local_options() -> LocalAgentOptions:
    return LocalAgentOptions(cwd=str(PROJECT_ROOT))


def _agent_options(*, model: str = "composer-2.5") -> AgentOptions:
    return AgentOptions(
        api_key=os.environ["CURSOR_API_KEY"],
        model=model,
        local=_local_options(),
    )


def result_text(result) -> str:
    if hasattr(result, "result") and result.result:
        return str(result.result)
    return str(result)


class BridgeManager:
    """Reuses a single Cursor SDK bridge for the API process lifetime."""

    def __init__(self) -> None:
        self._client: AsyncClient | None = None
        self._lock = asyncio.Lock()

    @property
    def is_running(self) -> bool:
        return self._client is not None

    async def start(self) -> None:
        if not os.environ.get("CURSOR_API_KEY", "").strip():
            return
        async with self._lock:
            if self._client is not None:
                return
            local = _local_options()
            self._client = await AsyncClient.launch_bridge(
                workspace=str(PROJECT_ROOT),
                local=local,
            )

    async def stop(self) -> None:
        async with self._lock:
            client = self._client
            self._client = None
        if client is not None:
            await client.close()

    async def _get_client(self) -> AsyncClient:
        if self._client is None:
            await self.start()
        if self._client is None:
            raise RuntimeError("CURSOR_API_KEY is not configured")
        return self._client

    async def _reconnect(self) -> AsyncClient:
        await self.stop()
        await self.start()
        return await self._get_client()

    async def agent_prompt(self, prompt: str, *, model: str = "composer-2.5"):
        try:
            client = await self._get_client()
            return await AsyncAgent.prompt(
                prompt,
                _agent_options(model=model),
                client=client,
            )
        except Exception:
            client = await self._reconnect()
            return await AsyncAgent.prompt(
                prompt,
                _agent_options(model=model),
                client=client,
            )


bridge_manager = BridgeManager()


async def agent_prompt(prompt: str, *, model: str = "composer-2.5"):
    return await bridge_manager.agent_prompt(prompt, model=model)


def agent_prompt_blocking(prompt: str, *, model: str = "composer-2.5"):
    def _run():
        return asyncio.run(agent_prompt(prompt, model=model))

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return _run()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(_run).result()


@asynccontextmanager
async def bridge_lifespan(_app) -> AsyncIterator[None]:
    yield
    await bridge_manager.stop()
