from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from app.models import GeneratedLetter, LetterPlan, LetterPlanResponse, ParsedReport
from app.services.letter_current import current_letters, superseded_letter_ids
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
    if report.credit_intelligence is not None:
        payload["intelligence_json"] = report.credit_intelligence.model_dump()
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
    # Replace the prior file for this plan instead of appending a new copy.
    client.table("dispute_letters").delete().eq("session_id", session_id).eq("plan_id", plan_id).execute()
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


def _letter_from_row(row: dict) -> GeneratedLetter:
    return GeneratedLetter(
        id=row["id"],
        plan_id=row["plan_id"],
        title=row["title"],
        markdown=row["markdown"],
        file_path=row.get("storage_path") or "",
    )


def list_letter_rows(session_id: str) -> list[GeneratedLetter]:
    client = get_supabase()
    rows = (
        client.table("dispute_letters")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    return [_letter_from_row(r) for r in (rows.data or [])]


def list_letters(session_id: str) -> list[GeneratedLetter]:
    """Current letters only — one file per recipient/plan, latest generation wins."""
    return current_letters(list_letter_rows(session_id))


def prepare_session_letters_for_generation(
    session_id: str,
    plans: list[LetterPlan],
    *,
    replacing_all: bool,
) -> None:
    """Drop prior generations so regenerate replaces files instead of appending copies."""
    if replacing_all:
        clear_session_letters(session_id)
        return
    ids = superseded_letter_ids(list_letter_rows(session_id), plans)
    if not ids:
        return
    get_supabase().table("dispute_letters").delete().eq("session_id", session_id).in_("id", ids).execute()


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
    return _letter_from_row(data)


def session_letter_round(session_id: str, application_uuid: str | None = None) -> int:
    """1-based index of this session among the application's reports (oldest first)."""
    if not application_uuid:
        return 1
    client = get_supabase()
    rows = (
        client.table("dispute_sessions")
        .select("id,created_at")
        .eq("application_uuid", application_uuid)
        .order("created_at")
        .execute()
    )
    ids = [r["id"] for r in (rows.data or [])]
    try:
        return ids.index(session_id) + 1
    except ValueError:
        return 1


def clear_session_letters(session_id: str) -> None:
    client = get_supabase()
    client.table("dispute_letters").delete().eq("session_id", session_id).execute()
