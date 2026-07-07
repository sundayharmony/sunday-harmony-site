from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from app.models import GeneratedLetter, LetterPlanResponse, ParsedReport
from app.supabase_client import get_supabase


def init_db() -> None:
    """No-op: schema managed by Supabase migration 022."""


def get_session(session_id: str) -> tuple[str, str, ParsedReport] | None:
    client = get_supabase()
    row = (
        client.table("dispute_sessions")
        .select("storage_path,file_type,report_json,status")
        .eq("id", session_id)
        .maybe_single()
        .execute()
    )
    data = row.data
    if not data or not data.get("report_json"):
        return None
    report = ParsedReport.model_validate(data["report_json"])
    return data["storage_path"], data.get("file_type") or "", report


def get_session_row(session_id: str) -> dict | None:
    client = get_supabase()
    row = client.table("dispute_sessions").select("*").eq("id", session_id).maybe_single().execute()
    return row.data


def set_session_status(session_id: str, status: str, *, error_message: str | None = None) -> None:
    client = get_supabase()
    payload: dict = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if error_message is not None:
        payload["error_message"] = error_message
    client.table("dispute_sessions").update(payload).eq("id", session_id).execute()


def update_session_report(session_id: str, report: ParsedReport, *, file_type: str = "") -> bool:
    client = get_supabase()
    payload: dict = {
        "report_json": report.model_dump(),
        "status": "ready",
        "error_message": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if file_type:
        payload["file_type"] = file_type
    result = client.table("dispute_sessions").update(payload).eq("id", session_id).execute()
    return bool(result.data)


def save_letter_plan(session_id: str, plan: LetterPlanResponse) -> None:
    client = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    client.table("dispute_letter_plans").upsert(
        {
            "session_id": session_id,
            "plans_json": [p.model_dump() for p in plan.plans],
            "created_at": now,
        }
    ).execute()


def get_letter_plan(session_id: str) -> LetterPlanResponse | None:
    client = get_supabase()
    row = (
        client.table("dispute_letter_plans")
        .select("plans_json")
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    data = row.data
    if not data or not data.get("plans_json"):
        return None
    from app.models import LetterPlan

    plans = [LetterPlan.model_validate(p) for p in data["plans_json"]]
    return LetterPlanResponse(session_id=session_id, plans=plans)


def save_letter(
    session_id: str,
    plan_id: str,
    title: str,
    markdown: str,
    file_path: str,
    *,
    letter_id: str | None = None,
) -> str:
    lid = letter_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    client = get_supabase()
    client.table("dispute_letters").insert(
        {
            "id": lid,
            "session_id": session_id,
            "plan_id": plan_id,
            "title": title,
            "markdown": markdown,
            "storage_path": file_path,
            "created_at": now,
        }
    ).execute()
    return lid


def list_letters(session_id: str) -> list[GeneratedLetter]:
    client = get_supabase()
    rows = (
        client.table("dispute_letters")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    return [
        GeneratedLetter(
            id=r["id"],
            plan_id=r["plan_id"],
            title=r["title"],
            markdown=r["markdown"],
            file_path=r.get("storage_path") or "",
        )
        for r in (rows.data or [])
    ]


def get_letter(session_id: str, letter_id: str) -> GeneratedLetter | None:
    client = get_supabase()
    row = (
        client.table("dispute_letters")
        .select("*")
        .eq("session_id", session_id)
        .eq("id", letter_id)
        .maybe_single()
        .execute()
    )
    data = row.data
    if not data:
        return None
    return GeneratedLetter(
        id=data["id"],
        plan_id=data["plan_id"],
        title=data["title"],
        markdown=data["markdown"],
        file_path=data.get("storage_path") or "",
    )


def clear_session_letters(session_id: str) -> None:
    client = get_supabase()
    client.table("dispute_letters").delete().eq("session_id", session_id).execute()
