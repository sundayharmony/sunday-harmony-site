"""Background letter generation (start + poll), shared with blocking and stream endpoints."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from app.db import (
    get_letter_plan,
    get_session,
    prepare_session_letters_for_generation,
    save_letter,
    update_session_report,
)
from app.services.letter_generator import generate_letter_async, save_letter_file
from app.services.letter_job_result import empty_letters_error

ProgressCallback = Callable[[dict[str, Any]], Awaitable[None] | None]

_letter_jobs: dict[str, asyncio.Task] = {}
_letter_job_state: dict[str, dict[str, Any]] = {}


def get_letter_job_state(session_id: str) -> dict[str, Any] | None:
    return _letter_job_state.get(session_id)


def letter_job_running(session_id: str) -> bool:
    task = _letter_jobs.get(session_id)
    return bool(task is not None and not task.done())


def apply_letter_consumer(
    report,
    *,
    consumer_name: str | None = None,
    consumer_addresses: list[str] | None = None,
):
    if consumer_name is not None and consumer_name.strip():
        report.consumer.name = consumer_name.strip()
    if consumer_addresses is not None:
        report.consumer.addresses = [
            a.strip() for a in consumer_addresses if a and str(a).strip()
        ]
    return report


def _blank_state(session_id: str) -> dict[str, Any]:
    return {
        "status": "generating",
        "session_id": session_id,
        "current": 0,
        "total": 0,
        "title": "",
        "letters": [],
        "skipped": [],
        "error_message": None,
        "job_running": True,
    }


async def run_letter_job(
    session_id: str,
    plan_ids: list[str] | None = None,
    *,
    consumer_name: str | None = None,
    consumer_addresses: list[str] | None = None,
    on_event: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Generate current letters for a session. Does not upload .txt copies to storage."""
    state = _blank_state(session_id)
    _letter_job_state[session_id] = state

    async def emit(event: dict[str, Any]) -> None:
        if on_event:
            result = on_event(event)
            if asyncio.iscoroutine(result):
                await result

    try:
        row = get_session(session_id)
        if not row:
            raise RuntimeError("Session not found")
        _, _, report = row

        if consumer_name is not None or consumer_addresses is not None:
            apply_letter_consumer(
                report,
                consumer_name=consumer_name,
                consumer_addresses=consumer_addresses,
            )
            update_session_report(session_id, report)

        plan_resp = get_letter_plan(session_id)
        if not plan_resp:
            raise RuntimeError("No dispute plan found. Call /internal/disputes/plan first.")

        plans = plan_resp.plans
        if plan_ids:
            plans = [p for p in plans if p.id in plan_ids]
        prepare_session_letters_for_generation(
            session_id, plans, replacing_all=not plan_ids
        )

        total = len(plans)
        state["total"] = total
        generated: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []

        for i, plan in enumerate(plans, 1):
            state["current"] = i
            state["title"] = plan.recipient_name
            await emit(
                {
                    "status": "progress",
                    "current": i,
                    "total": total,
                    "plan_id": plan.id,
                    "title": plan.recipient_name,
                }
            )
            if plan.missing_address:
                item = {
                    "plan_id": plan.id,
                    "recipient_name": plan.recipient_name,
                    "reason": "missing_address",
                }
                skipped.append(item)
                state["skipped"] = skipped
                await emit({"status": "skipped", **item})
                continue

            md = await generate_letter_async(plan, report.consumer, report)
            path = save_letter_file(session_id, plan, md)
            title = f"{plan.recipient_name} — {len(plan.items)} item(s)"
            letter_id = save_letter(session_id, plan.id, title, md, str(path))
            generated.append(
                {
                    "id": letter_id,
                    "plan_id": plan.id,
                    "title": title,
                    "markdown": md,
                    "file_path": str(path),
                }
            )
            state["letters"] = generated
            await emit({"status": "done", "letter_id": letter_id, "title": title})

        if not generated:
            raise RuntimeError(empty_letters_error(skipped))

        state["status"] = "complete"
        state["job_running"] = False
        state["skipped"] = skipped
        state["letters"] = generated
        await emit(
            {
                "status": "complete",
                "skipped": skipped,
                "letters": generated,
            }
        )
        return state
    except Exception as e:
        state["status"] = "failed"
        state["job_running"] = False
        state["error_message"] = str(e)
        await emit(
            {
                "status": "error",
                "error": str(e),
                "skipped": state.get("skipped") or [],
            }
        )
        raise


def spawn_letter_job(
    session_id: str,
    plan_ids: list[str] | None = None,
    *,
    consumer_name: str | None = None,
    consumer_addresses: list[str] | None = None,
) -> None:
    existing = _letter_jobs.get(session_id)
    if existing and not existing.done():
        return

    _letter_job_state[session_id] = _blank_state(session_id)

    async def _runner() -> None:
        try:
            await run_letter_job(
                session_id,
                plan_ids,
                consumer_name=consumer_name,
                consumer_addresses=consumer_addresses,
            )
        except Exception:
            pass
        finally:
            _letter_jobs.pop(session_id, None)

    _letter_jobs[session_id] = asyncio.create_task(_runner())
