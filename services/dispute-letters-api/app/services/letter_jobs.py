"""Background letter generation (start + poll), shared with blocking and stream endpoints."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from app.db import (
    get_letter_plan,
    get_session,
    get_session_row,
    prepare_session_letters_for_generation,
    save_letter,
    session_letter_round,
    update_session_report,
)
from app.services.letter_consumer import apply_letter_consumer
from app.services.letter_current import letter_display_title, letter_party_label
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
    consumer_ssn: str | None = None,
    consumer_dob: str | None = None,
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

        if any(
            value is not None
            for value in (consumer_name, consumer_addresses, consumer_ssn, consumer_dob)
        ):
            apply_letter_consumer(
                report,
                consumer_name=consumer_name,
                consumer_addresses=consumer_addresses,
                consumer_ssn=consumer_ssn,
                consumer_dob=consumer_dob,
            )
            update_session_report(session_id, report)

        plan_resp = get_letter_plan(session_id)
        if not plan_resp:
            raise RuntimeError("No dispute plan found. Call /internal/disputes/plan first.")
        session_row = get_session_row(session_id) or {}
        round_number = session_letter_round(session_id, session_row.get("application_uuid"))

        plans = plan_resp.plans
        if plan_ids:
            plans = [p for p in plans if p.id in plan_ids]
        prepare_session_letters_for_generation(
            session_id, plans, replacing_all=not plan_ids
        )

        total = len(plans)
        state["total"] = total
        party_for = _party_labels(plans)
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
            title = letter_display_title(
                person_name=report.consumer.name,
                party=party_for[plan.id],
                round_number=round_number,
            )
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
    consumer_ssn: str | None = None,
    consumer_dob: str | None = None,
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
                consumer_ssn=consumer_ssn,
                consumer_dob=consumer_dob,
            )
        except Exception:
            pass
        finally:
            _letter_jobs.pop(session_id, None)

    _letter_jobs[session_id] = asyncio.create_task(_runner())


def _party_labels(plans: list) -> dict[str, str]:
    """Title party per plan. Several letters to the same party in one run (e.g. one CFPB
    complaint per item) are numbered, so they don't replace each other as "current"."""
    labels = {plan.id: letter_party_label(plan.letter_type, plan.recipient_name) for plan in plans}
    groups: dict[str, list[str]] = {}
    for plan in plans:
        groups.setdefault(labels[plan.id].casefold(), []).append(plan.id)
    for ids in groups.values():
        if len(ids) > 1:
            for index, plan_id in enumerate(ids, 1):
                labels[plan_id] = f"{labels[plan_id]} (letter {index} of {len(ids)})"
    return labels

