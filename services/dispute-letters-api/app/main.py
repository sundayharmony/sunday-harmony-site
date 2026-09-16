from __future__ import annotations

import asyncio
import json
import os
import re
from io import BytesIO
from pathlib import Path

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.db import (
    get_letter,
    get_session,
    get_session_row,
    init_db,
    list_letters,
    save_letter_plan,
    session_letter_round,
    set_session_status,
    update_session_report,
)
from app.ingest.router import detect_file_type, ingest_file
from app.models import (
    ConsumerUpdateRequest,
    DisputePlanRequest,
    GenerateLettersRequest,
    IntelligenceRequest,
    LetterPlanResponse,
    ParsedReport,
    ReportHealthResponse,
    ReportSessionResponse,
    TradelineUpdateRequest,
)
from app.services.credit_health import sort_by_priority
from app.services.credit_intelligence import build_credit_intelligence
from app.services.cursor_client import bridge_manager
from app.services.letter_jobs import (
    get_letter_job_state,
    letter_job_running,
    run_letter_job,
    spawn_letter_job,
)
from app.services.letter_formatter import (
    finalize_letter,
    letter_layout,
    letter_to_docx,
    letter_to_html,
    letters_zip_bytes,
)
from app.services.letter_identity import load_application_enclosure_files
from app.services.letter_router import build_plan
from app.services.report_analyzer import analyze_report_async, cursor_api_configured
from app.services.report_refresh import recover_scores_from_storage, refresh_report_health
from app.storage import write_temp_report
from app.supabase_client import ping_supabase, supabase_env_configured

load_dotenv()


@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    init_db()
    yield
    await bridge_manager.stop()


app = FastAPI(title="Dispute Letters API", lifespan=app_lifespan)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    """Return JSON with a useful message instead of opaque 'Internal Server Error'."""
    from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse
    from starlette.exceptions import HTTPException as StarletteHTTPException

    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    if isinstance(exc, StarletteHTTPException):
        return await http_exception_handler(request, exc)
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)
    msg = str(exc).strip() or exc.__class__.__name__
    return JSONResponse(status_code=500, content={"detail": msg[:500], "error": msg[:500]})


_allowed_origins = os.environ.get("DISPUTE_CORS_ORIGINS", "").strip()
if _allowed_origins:
    origins = [o.strip() for o in _allowed_origins.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_internal_secret(authorization: str | None = Header(default=None)) -> None:
    secret = os.environ.get("DISPUTE_LETTERS_API_SECRET", "").strip()
    if not secret:
        raise HTTPException(503, "DISPUTE_LETTERS_API_SECRET not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Unauthorized")
    token = authorization[7:].strip()
    if token != secret:
        raise HTTPException(401, "Unauthorized")


class AnalyzeStreamRequest(BaseModel):
    session_id: str
    storage_path: str
    file_name: str = ""


class GenerateStreamRequest(BaseModel):
    session_id: str
    plan_ids: list[str] | None = None
    consumer_name: str | None = None
    consumer_addresses: list[str] | None = None


# In-flight analyze jobs (same process). Survives the HTTP response for /analyze/start.
_analyze_jobs: dict[str, asyncio.Task] = {}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict:
    """Liveness + Supabase reachability (use this after deploy to verify env vars)."""
    sb = ping_supabase()
    if not sb.get("ok"):
        raise HTTPException(
            503,
            sb.get("error")
            or "Supabase unreachable. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Render.",
        )
    return {"status": "ready", "supabase": "ok"}


@app.get("/config")
def config() -> dict:
    sb = ping_supabase()
    return {
        "cursor_api_configured": cursor_api_configured(),
        "supabase_configured": supabase_env_configured(),
        "supabase_ok": bool(sb.get("ok")),
        "supabase_error": None if sb.get("ok") else sb.get("error"),
        "supabase_url_host": sb.get("url_host"),
        "supabase_url_length": sb.get("url_length"),
    }


def _suffix_from_path(storage_path: str, file_name: str) -> str:
    for name in (file_name, storage_path):
        if name and "." in name:
            return Path(name).suffix.lower()
    return ".pdf"


async def _run_analyze_job(session_id: str, storage_path: str, file_name: str) -> dict:
    """Ingest + analyze a report; always writes a terminal session status to Supabase."""
    temp_path: Path | None = None
    try:
        row = get_session_row(session_id)
        if not row:
            raise RuntimeError("Session not found")

        set_session_status(session_id, "analyzing")

        ext = _suffix_from_path(storage_path, file_name)
        detect_file_type(Path(f"x{ext}"))

        temp_path = await asyncio.to_thread(write_temp_report, storage_path, ext)
        doc = await asyncio.to_thread(ingest_file, temp_path)
        report = await analyze_report_async(doc, allow_fallback=True, file_name=file_name)
        update_session_report(session_id, report, file_type=doc.file_type)
        return {
            "status": "complete",
            "session_id": session_id,
            "report": report.model_dump(),
        }
    except Exception as e:
        set_session_status(session_id, "failed", error_message=str(e))
        raise
    finally:
        _analyze_jobs.pop(session_id, None)
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


def _spawn_analyze_job(session_id: str, storage_path: str, file_name: str) -> None:
    existing = _analyze_jobs.get(session_id)
    if existing and not existing.done():
        return

    async def _runner() -> None:
        try:
            await _run_analyze_job(session_id, storage_path, file_name)
        except Exception:
            # Status already persisted inside _run_analyze_job.
            pass

    _analyze_jobs[session_id] = asyncio.create_task(_runner())


@app.post("/internal/analyze/start")
async def analyze_start(
    body: AnalyzeStreamRequest,
    _: None = Depends(verify_internal_secret),
):
    """Kick off analysis in the background and return immediately (no SSE)."""
    sb = ping_supabase()
    if not sb.get("ok"):
        raise HTTPException(
            503,
            sb.get("error")
            or "Supabase unreachable on analysis API. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Render.",
        )

    row = get_session_row(body.session_id)
    if not row:
        raise HTTPException(404, "Session not found")

    try:
        detect_file_type(Path(f"x{_suffix_from_path(body.storage_path, body.file_name)}"))
    except ValueError as e:
        set_session_status(body.session_id, "failed", error_message=str(e))
        raise HTTPException(400, str(e)) from e

    set_session_status(body.session_id, "analyzing")
    _spawn_analyze_job(body.session_id, body.storage_path, body.file_name)
    return {
        "status": "analyzing",
        "session_id": body.session_id,
        "message": "Analysis started",
    }


@app.post("/internal/analyze")
async def analyze(
    body: AnalyzeStreamRequest,
    _: None = Depends(verify_internal_secret),
):
    """Blocking analyze — waits until the report is ready (or fails)."""
    row = get_session_row(body.session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    try:
        return await _run_analyze_job(body.session_id, body.storage_path, body.file_name)
    except Exception as e:
        raise HTTPException(500, str(e)) from e


@app.get("/internal/sessions/{session_id}/status")
def session_status(session_id: str, _: None = Depends(verify_internal_secret)) -> dict:
    row = get_session_row(session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    task = _analyze_jobs.get(session_id)
    return {
        "session_id": session_id,
        "status": row.get("status") or "unknown",
        "error_message": row.get("error_message"),
        "job_running": bool(task is not None and not task.done()),
    }


@app.post("/internal/analyze/stream")
async def analyze_stream(
    body: AnalyzeStreamRequest,
    _: None = Depends(verify_internal_secret),
):
    """Legacy SSE endpoint — prefer /internal/analyze/start + status polling."""

    async def event_stream():
        terminal = False
        try:
            row = get_session_row(body.session_id)
            if not row:
                terminal = True
                yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
                return

            set_session_status(body.session_id, "analyzing")
            yield f"data: {json.dumps({'status': 'ingesting', 'message': 'Reading file…'})}\n\n"
            yield f"data: {json.dumps({'status': 'analyzing', 'message': 'Running Credit Intelligence analysis…'})}\n\n"

            task = asyncio.create_task(
                _run_analyze_job(body.session_id, body.storage_path, body.file_name)
            )
            while not task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(task), timeout=8.0)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    yield f"data: {json.dumps({'status': 'analyzing', 'message': 'Still analyzing…'})}\n\n"

            result = task.result()
            terminal = True
            yield f"data: {json.dumps(result)}\n\n"
        except Exception as e:
            if not terminal:
                set_session_status(body.session_id, "failed", error_message=str(e))
            terminal = True
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if not terminal:
                try:
                    set_session_status(
                        body.session_id,
                        "failed",
                        error_message="Analysis stream ended before completion",
                    )
                except Exception:
                    pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/internal/reports/{session_id}/health", response_model=ReportHealthResponse)
def get_report_health(session_id: str, _: None = Depends(verify_internal_secret)) -> ReportHealthResponse:
    row = get_session_row(session_id)
    if not row or not row.get("report_json"):
        raise HTTPException(404, "Session not found")
    report = ParsedReport.model_validate(row["report_json"])
    refresh_report_health(report, row.get("file_name") or "")
    recover_scores_from_storage(report, row)
    if report.credit_intelligence is None:
        report.credit_intelligence = build_credit_intelligence(report)
    update_session_report(session_id, report)
    return ReportHealthResponse(
        session_id=session_id,
        credit_health=report.credit_health,
        credit_intelligence=report.credit_intelligence,
        tradelines_by_priority=sort_by_priority(report.tradelines),
        consumer_name=report.consumer.name,
        report_date=report.report_date,
        source=report.source,
    )


@app.post("/internal/reports/{session_id}/intelligence")
def rebuild_intelligence(
    session_id: str,
    body: IntelligenceRequest,
    _: None = Depends(verify_internal_secret),
) -> dict:
    row = get_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    _, _, report = row
    intelligence = build_credit_intelligence(report, funding=body.funding_context)
    report.credit_intelligence = intelligence
    if not update_session_report(session_id, report):
        raise HTTPException(404, "Session not found")
    return {"session_id": session_id, "credit_intelligence": intelligence.model_dump()}


@app.get("/internal/reports/{session_id}", response_model=ReportSessionResponse)
def get_report(session_id: str, _: None = Depends(verify_internal_secret)) -> ReportSessionResponse:
    row = get_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    _, _, report = row
    return ReportSessionResponse(session_id=session_id, report=report)


@app.patch("/internal/reports/{session_id}/tradelines", response_model=ReportSessionResponse)
def patch_tradelines(
    session_id: str,
    body: TradelineUpdateRequest,
    _: None = Depends(verify_internal_secret),
) -> ReportSessionResponse:
    row = get_session_row(session_id)
    if not row or not row.get("report_json"):
        raise HTTPException(404, "Session not found")
    report = ParsedReport.model_validate(row["report_json"])
    report.tradelines = body.tradelines
    refresh_report_health(report, row.get("file_name") or "")
    recover_scores_from_storage(report, row)
    if not update_session_report(session_id, report):
        raise HTTPException(404, "Session not found")
    return ReportSessionResponse(session_id=session_id, report=report)


@app.patch("/internal/reports/{session_id}/consumer", response_model=ReportSessionResponse)
def patch_consumer(
    session_id: str,
    body: ConsumerUpdateRequest,
    _: None = Depends(verify_internal_secret),
) -> ReportSessionResponse:
    row = get_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    _, _, report = row
    if body.name is not None and body.name.strip():
        report.consumer.name = body.name.strip()
    if body.addresses is not None:
        report.consumer.addresses = [a.strip() for a in body.addresses if a and a.strip()]
    if not update_session_report(session_id, report):
        raise HTTPException(404, "Session not found")
    return ReportSessionResponse(session_id=session_id, report=report)


@app.post("/internal/disputes/plan", response_model=LetterPlanResponse)
def dispute_plan(body: DisputePlanRequest, _: None = Depends(verify_internal_secret)) -> LetterPlanResponse:
    row = get_session(body.session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    _, _, report = row
    plan = build_plan(body.session_id, report, body)
    save_letter_plan(body.session_id, plan)
    return plan


@app.post("/internal/letters/generate/start")
async def generate_letters_start(
    body: GenerateLettersRequest,
    _: None = Depends(verify_internal_secret),
):
    """Kick off letter generation in the background (no SSE). Client should poll generate-status."""
    row = get_session_row(body.session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    spawn_letter_job(
        body.session_id,
        body.plan_ids,
        consumer_name=body.consumer_name,
        consumer_addresses=body.consumer_addresses,
    )
    return {
        "status": "generating",
        "session_id": body.session_id,
        "message": "Letter generation started",
    }


@app.get("/internal/letter-jobs/{session_id}")
def generate_letters_status(session_id: str, _: None = Depends(verify_internal_secret)) -> dict:
    state = get_letter_job_state(session_id)
    if not state:
        return {
            "session_id": session_id,
            "status": "idle",
            "letters": [],
            "skipped": [],
            "job_running": letter_job_running(session_id),
            "error_message": None,
        }
    return {**state, "job_running": letter_job_running(session_id)}


@app.post("/internal/letters/generate/stream")
async def generate_letters_stream(
    body: GenerateStreamRequest,
    _: None = Depends(verify_internal_secret),
):
    """Deprecated SSE fallback — prefer /internal/letters/generate/start + letter-jobs polling."""

    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()

        async def on_event(event: dict) -> None:
            await queue.put(event)

        task = asyncio.create_task(
            run_letter_job(
                body.session_id,
                body.plan_ids,
                consumer_name=body.consumer_name,
                consumer_addresses=body.consumer_addresses,
                on_event=on_event,
            )
        )
        terminal = False
        try:
            while not task.done() or not queue.empty():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=2.0)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("status") in ("complete", "error"):
                        terminal = True
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
            if not terminal:
                try:
                    await task
                    yield f"data: {json.dumps({'status': 'complete'})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/internal/letters/generate")
async def generate_letters(body: GenerateLettersRequest, _: None = Depends(verify_internal_secret)) -> dict:
    """Blocking generate — same core path as start + poll."""
    row = get_session_row(body.session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    try:
        return await run_letter_job(
            body.session_id,
            body.plan_ids,
            consumer_name=body.consumer_name,
            consumer_addresses=body.consumer_addresses,
        )
    except RuntimeError as e:
        message = str(e)
        status = 404 if "not found" in message.lower() else 400
        raise HTTPException(status, message) from e
    except Exception as e:
        raise HTTPException(500, str(e)) from e


@app.get("/internal/letters/{session_id}")
def get_letters(session_id: str, _: None = Depends(verify_internal_secret)) -> dict:
    letters = list_letters(session_id)
    cleaned = [
        {
            **l.model_dump(),
            "markdown": l.markdown,
            "html": letter_to_html(l.markdown),
            "preview": letter_layout(l.markdown),
            "plain_text": finalize_letter(l.markdown),
        }
        for l in letters
    ]
    return {"session_id": session_id, "letters": cleaned}


def _letter_docx_response(letter, enclosure_files: list[tuple[str, bytes]] | None = None):
    document = letter_to_docx(letter.markdown, enclosure_files=enclosure_files or [])
    buf = BytesIO()
    document.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="letter_{letter.id}.docx"'},
    )


@app.get("/internal/letters/{session_id}/{letter_id}/download")
def download_letter(
    session_id: str,
    letter_id: str,
    format: str = "docx",
    _: None = Depends(verify_internal_secret),
):
    letter = get_letter(session_id, letter_id)
    if not letter:
        raise HTTPException(404, "Letter not found")
    body = finalize_letter(letter.markdown)
    if format in ("md", "txt"):
        return StreamingResponse(
            BytesIO(body.encode("utf-8")),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="letter_{letter_id}.txt"'},
        )
    if format == "docx":
        row = get_session_row(session_id) or {}
        files = load_application_enclosure_files(row.get("application_uuid"))
        return _letter_docx_response(letter, files)
    raise HTTPException(400, "Unsupported format")


@app.post("/internal/letters/{session_id}/{letter_id}/download")
async def download_letter_with_enclosures(
    session_id: str,
    letter_id: str,
    format: str = "docx",
    enclosures: list[UploadFile] = File(default_factory=list),
    _: None = Depends(verify_internal_secret),
):
    letter = get_letter(session_id, letter_id)
    if not letter:
        raise HTTPException(404, "Letter not found")
    if format != "docx":
        raise HTTPException(400, "Unsupported format")
    files: list[tuple[str, bytes]] = []
    for upload in enclosures or []:
        data = await upload.read()
        if data:
            files.append((upload.filename or "enclosure.bin", data))
    if not files:
        row = get_session_row(session_id) or {}
        files = load_application_enclosure_files(row.get("application_uuid"))
    return _letter_docx_response(letter, files)


@app.get("/internal/letters/{session_id}/download.zip")
def download_zip(session_id: str, _: None = Depends(verify_internal_secret)):
    letters = list_letters(session_id)
    if not letters:
        raise HTTPException(404, "No letters")
    row = get_session_row(session_id)
    consumer_name = "Client"
    if row and row.get("report_json"):
        consumer_name = (row["report_json"].get("consumer") or {}).get("name") or "Client"
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "", consumer_name.strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()[:80] or "Client"
    round_index = session_letter_round(session_id, (row or {}).get("application_uuid"))
    zip_filename = f"{cleaned} round {round_index} Letters.zip"
    payload = letters_zip_bytes([(letter.title.replace("/", "-")[:60] or letter.id, letter.markdown) for letter in letters])
    buf = BytesIO(payload)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename.replace(chr(34), "")}"'},
    )
