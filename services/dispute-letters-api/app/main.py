from __future__ import annotations

import asyncio
import json
import os
import re
import zipfile
from io import BytesIO
from pathlib import Path

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.config import LETTERS_DIR, REPORTS_DIR
from app.db import (
    get_letter,
    get_letter_plan,
    get_session,
    get_session_row,
    init_db,
    list_letters,
    save_letter,
    save_letter_plan,
    set_session_status,
    update_session_report,
)
from app.ingest.router import detect_file_type, ingest_file
from app.models import (
    DisputePlanRequest,
    GenerateLettersRequest,
    GeneratedLetter,
    IntelligenceRequest,
    LetterPlanResponse,
    ReportHealthResponse,
    ReportSessionResponse,
    TradelineUpdateRequest,
)
from app.services.credit_health import build_health_summary, sort_by_priority
from app.services.credit_intelligence import build_credit_intelligence
from app.services.cursor_client import bridge_manager
from app.services.letter_generator import generate_letter_async, save_letter_file
from app.services.letter_formatter import finalize_letter, letter_to_docx, letter_to_html
from app.services.letter_router import build_plan
from app.services.report_analyzer import analyze_report_async, cursor_api_configured
from app.storage import upload_storage_bytes, write_temp_report

load_dotenv()


@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    init_db()
    yield
    await bridge_manager.stop()


app = FastAPI(title="Dispute Letters API", lifespan=app_lifespan)

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


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/config")
def config() -> dict:
    return {"cursor_api_configured": cursor_api_configured()}


def _require_cursor_key() -> None:
    if not cursor_api_configured():
        raise HTTPException(
            503,
            "CURSOR_API_KEY is required for report analysis. Add it to .env and restart the API.",
        )


def _suffix_from_path(storage_path: str, file_name: str) -> str:
    for name in (file_name, storage_path):
        if name and "." in name:
            return Path(name).suffix.lower()
    return ".pdf"


@app.post("/internal/analyze/stream")
async def analyze_stream(
    body: AnalyzeStreamRequest,
    _: None = Depends(verify_internal_secret),
):
    _require_cursor_key()

    async def event_stream():
        temp_path: Path | None = None
        try:
            row = get_session_row(body.session_id)
            if not row:
                yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
                return

            set_session_status(body.session_id, "analyzing")
            yield f"data: {json.dumps({'status': 'ingesting', 'message': 'Reading file…'})}\n\n"

            ext = _suffix_from_path(body.storage_path, body.file_name)
            try:
                detect_file_type(Path(f"x{ext}"))
            except ValueError as e:
                set_session_status(body.session_id, "failed", error_message=str(e))
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                return

            temp_path = write_temp_report(body.storage_path, ext)
            doc = ingest_file(temp_path)

            yield f"data: {json.dumps({'status': 'analyzing', 'message': 'Running Credit Intelligence analysis…'})}\n\n"
            report = await analyze_report_async(
                doc, allow_fallback=True, file_name=body.file_name
            )
            update_session_report(body.session_id, report, file_type=doc.file_type)

            yield f"data: {json.dumps({'status': 'complete', 'session_id': body.session_id, 'report': report.model_dump()})}\n\n"
        except Exception as e:
            set_session_status(body.session_id, "failed", error_message=str(e))
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if temp_path and temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/internal/reports/{session_id}/health", response_model=ReportHealthResponse)
def get_report_health(session_id: str, _: None = Depends(verify_internal_secret)) -> ReportHealthResponse:
    row = get_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    _, _, report = row
    health = report.credit_health or build_health_summary(report)
    intelligence = report.credit_intelligence or build_credit_intelligence(report)
    if report.credit_intelligence is None:
        report.credit_intelligence = intelligence
        update_session_report(session_id, report)
    return ReportHealthResponse(
        session_id=session_id,
        credit_health=health,
        credit_intelligence=intelligence,
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
    row = get_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    _, _, report = row
    report.tradelines = body.tradelines
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


@app.post("/internal/letters/generate/stream")
async def generate_letters_stream(
    body: GenerateStreamRequest,
    _: None = Depends(verify_internal_secret),
):
    async def event_stream():
        row = get_session(body.session_id)
        if not row:
            yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
            return
        _, _, report = row
        plan_resp = get_letter_plan(body.session_id)
        if not plan_resp:
            yield f"data: {json.dumps({'error': 'No dispute plan'})}\n\n"
            return

        plans = plan_resp.plans
        if body.plan_ids:
            plans = [p for p in plans if p.id in body.plan_ids]

        total = len(plans)
        for i, plan in enumerate(plans, 1):
            yield f"data: {json.dumps({'status': 'progress', 'current': i, 'total': total, 'plan_id': plan.id, 'title': plan.recipient_name})}\n\n"
            await asyncio.sleep(0.05)
            if plan.missing_address:
                yield f"data: {json.dumps({'status': 'skipped', 'plan_id': plan.id, 'reason': 'missing_address'})}\n\n"
                continue
            md = await generate_letter_async(plan, report.consumer, report)
            path = save_letter_file(body.session_id, plan, md)
            title = f"{plan.recipient_name} — {len(plan.items)} item(s)"
            storage_prefix = f"sessions/{body.session_id}/letters"
            txt_storage = f"{storage_prefix}/{plan.id}.txt"
            try:
                upload_storage_bytes(txt_storage, finalize_letter(md).encode("utf-8"), "text/plain")
            except Exception:
                txt_storage = str(path)
            letter_id = save_letter(body.session_id, plan.id, title, md, txt_storage)
            yield f"data: {json.dumps({'status': 'done', 'letter_id': letter_id, 'title': title})}\n\n"
        yield f"data: {json.dumps({'status': 'complete'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/internal/letters/generate")
def generate_letters(body: GenerateLettersRequest, _: None = Depends(verify_internal_secret)) -> dict:
    row = get_session(body.session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    _, _, report = row
    plan_resp = get_letter_plan(body.session_id)
    if not plan_resp:
        raise HTTPException(400, "No dispute plan found. Call /internal/disputes/plan first.")

    plans = plan_resp.plans
    if body.plan_ids:
        plans = [p for p in plans if p.id in body.plan_ids]

    generated: list[GeneratedLetter] = []
    for plan in plans:
        if plan.missing_address:
            continue
        import asyncio

        md = asyncio.run(generate_letter_async(plan, report.consumer, report))
        path = save_letter_file(body.session_id, plan, md)
        title = f"{plan.recipient_name} — {len(plan.items)} item(s)"
        letter_id = save_letter(body.session_id, plan.id, title, md, str(path))
        generated.append(
            GeneratedLetter(id=letter_id, plan_id=plan.id, title=title, markdown=md, file_path=str(path))
        )
    return {"session_id": body.session_id, "letters": generated}


@app.get("/internal/letters/{session_id}")
def get_letters(session_id: str, _: None = Depends(verify_internal_secret)) -> dict:
    letters = list_letters(session_id)
    cleaned = [
        {
            **l.model_dump(),
            "markdown": l.markdown,
            "html": letter_to_html(l.markdown),
            "plain_text": finalize_letter(l.markdown),
        }
        for l in letters
    ]
    return {"session_id": session_id, "letters": cleaned}


@app.get("/internal/letters/{session_id}/{letter_id}/download")
def download_letter(
    session_id: str,
    letter_id: str,
    format: str = "txt",
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
        document = letter_to_docx(letter.markdown)
        buf = BytesIO()
        document.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="letter_{letter_id}.docx"'},
        )
    raise HTTPException(400, "Unsupported format")


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
    zip_filename = f"{cleaned} round 1 Letters.zip"
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for letter in letters:
            plain = finalize_letter(letter.markdown)
            safe = letter.title.replace("/", "-")[:60] or letter.id
            zf.writestr(f"{safe}.txt", plain)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename.replace(chr(34), "")}"'},
    )
