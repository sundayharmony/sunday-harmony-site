"""Render disputed-account pages from the session report PDF for letter enclosures."""

from __future__ import annotations

import hashlib
import re
import threading
from io import BytesIO

from app.models import GeneratedLetter, LetterItem, Tradeline

# Process-local caches so a ZIP of N letters does not re-download / re-OCR / re-render
# the same report N times (that pegs free-tier CPU, OOMs the box, and stalls "Building ZIP").
_SCREENSHOT_CACHE: dict[str, list[tuple[str, bytes]]] = {}
_REPORT_PDF_CACHE: dict[str, bytes] = {}
_REPORT_TEXT_CACHE: dict[str, list[str]] = {}
_PAGE_JPEG_CACHE: dict[str, bytes] = {}
_SCREENSHOT_CACHE_LOCK = threading.Lock()
_SCREENSHOT_CACHE_MAX = 24
_REPORT_PDF_CACHE_MAX = 4
_REPORT_TEXT_CACHE_MAX = 8
_PAGE_JPEG_CACHE_MAX = 64
_DEFAULT_SCREENSHOT_DPI = 100


def account_match_tokens(creditor: str, account_number: str) -> list[str]:
    """Tokens that identify an account on a Credit Hero / bureau PDF page."""
    tokens: list[str] = []
    name = re.sub(r"\s+", " ", (creditor or "").strip())
    if len(re.sub(r"[^A-Za-z]", "", name)) >= 4:
        tokens.append(name.upper())
        # Truncated Credit Hero headers (DISCOVERCARD → DISCOVER, ALLY FINANCIAL → ALLY).
        first = name.split()[0]
        if len(re.sub(r"[^A-Za-z]", "", first)) >= 4:
            tokens.append(first.upper())
    raw = re.sub(r"[^A-Za-z0-9]", "", (account_number or "").upper())
    core = re.sub(r"X+$", "", raw)
    if len(core) >= 4:
        tokens.append(core)
    elif len(raw) >= 4:
        tokens.append(raw)
    # De-dupe preserving order.
    seen: set[str] = set()
    out: list[str] = []
    for token in tokens:
        if token and token not in seen:
            seen.add(token)
            out.append(token)
    return out


def disputed_items_from_letter_markdown(markdown: str) -> list[LetterItem]:
    """Best-effort parse Creditor / Account Number blocks from generated letter body."""
    items: list[LetterItem] = []
    pattern = re.compile(
        r"(?:\*\*(.+?)\*\*|^([A-Z][A-Z0-9&/.'/\- ]{2,60}))\s*\n"
        r"Account Number:\s*([^\n]+)",
        re.I | re.M,
    )
    for match in pattern.finditer(markdown or ""):
        creditor = (match.group(1) or match.group(2) or "").strip()
        account = (match.group(3) or "").strip()
        if not creditor or creditor.lower() in {"not reported", "enclosures"}:
            continue
        items.append(
            LetterItem(
                tradeline_id=f"md-{len(items)}",
                creditor=creditor,
                account_number="" if account.lower() == "not reported" else account,
            )
        )
    return items


def page_matches_tokens(page_text: str, tokens: list[str]) -> bool:
    blob = re.sub(r"\s+", " ", (page_text or "").upper())
    compact = re.sub(r"[^A-Z0-9]", "", blob)
    for token in tokens:
        needle = token.upper()
        if " " in needle or "/" in needle:
            if needle in blob:
                return True
            if re.sub(r"[^A-Z0-9]", "", needle) in compact:
                return True
        else:
            if needle in compact or needle in blob:
                return True
    return False


def is_score_summary_page(page_text: str) -> bool:
    """True for score/dashboard pages that are not tradeline account detail.

    FICO factor copy often says "past due" / "accounts" — those phrases must not
    override hard score markers like "What's hurting" or "FICO Bankcard Score".
    """
    blob = re.sub(r"\s+", " ", (page_text or "").upper())
    # Normalize curly apostrophes so "WHAT'S HURTING" matches extracted PDF text.
    blob = blob.replace("'", "'").replace("'", "'").replace("'", "'")
    if not blob.strip():
        return True
    hard_score_markers = (
        "WHAT'S HURTING",
        "WHATS HURTING",
        "WHAT IS HURTING",
        "WHAT'S HELPING",
        "WHATS HELPING",
        "FICO",
        "VANTAGESCORE",
        "BANKCARD SCORE",
        "CREDIT SCORE",
        "SCORE FACTOR",
        "SCORE SUMMARY",
        "YOUR SCORES",
        "BUREAU SCORES",
        "SCORE RANGE",
        "SCORE GAUGE",
    )
    if any(marker in blob for marker in hard_score_markers):
        return True
    has_account_detail = bool(
        re.search(
            r"ACCOUNT\s*(NUMBER|#|NO\.?)|PAYMENT\s*HISTORY|DATE\s*OPENED|"
            r"HIGH\s*BALANCE|CREDIT\s*LIMIT|REPORTED\s*STATUS|"
            r"BALANCE\s*:|ACCOUNT\s*TYPE",
            blob,
        )
    )
    if has_account_detail:
        return False
    if "SCORE" in blob and len(blob) < 800 and not re.search(r"ACCOUNT\s*(NUMBER|#|NO\.?)", blob):
        return True
    return False


def page_has_tradeline_detail(page_text: str) -> bool:
    """Require real tradeline fields — not score-factor prose that mentions accounts."""
    blob = re.sub(r"\s+", " ", (page_text or "").upper())
    return bool(
        re.search(
            r"ACCOUNT\s*(NUMBER|#|NO\.?)|PAYMENT\s*HISTORY|DATE\s*OPENED|"
            r"HIGH\s*BALANCE|CREDIT\s*LIMIT|REPORTED\s*STATUS|ACCOUNT\s*TYPE",
            blob,
        )
    )


def select_report_pages_for_items(
    page_texts: list[str], items: list[LetterItem], *, max_pages: int = 8
) -> list[int]:
    """1-based page numbers with disputed-account detail (never score dashboards)."""
    selected: list[int] = []
    for index, text in enumerate(page_texts, start=1):
        if is_score_summary_page(text):
            continue
        if not page_has_tradeline_detail(text):
            continue
        for item in items:
            tokens = account_match_tokens(item.creditor, item.account_number)
            if tokens and page_matches_tokens(text, tokens):
                selected.append(index)
                break
        if len(selected) >= max_pages:
            break
    return selected


_BUREAU_ACCOUNT_FIELDS = (
    ("TUC", "account_tu"),
    ("EXP", "account_exp"),
    ("EQF", "account_eqf"),
)
_BUREAU_PAGE_LABELS = {
    "TUC": ("TRANSUNION", "TRANS UNION"),
    "EXP": ("EXPERIAN",),
    "EQF": ("EQUIFAX",),
}


def account_number_core(account_number: str) -> str:
    """Account digits that can be found on a report page. Trailing masks are dropped."""
    raw = re.sub(r"[^A-Za-z0-9]", "", (account_number or "").upper())
    core = re.sub(r"X+$", "", raw)
    if len(core) >= 4:
        return core
    if len(raw) >= 4:
        return raw
    return ""


def page_named_bureaus(page_text: str) -> set[str]:
    blob = re.sub(r"\s+", " ", (page_text or "").upper())
    found: set[str] = set()
    for bureau, labels in _BUREAU_PAGE_LABELS.items():
        if any(label in blob for label in labels):
            found.add(bureau)
    return found


def select_tradeline_account_pages(
    page_texts: list[str],
    tradelines: list[Tradeline],
    *,
    max_pages: int = 8,
) -> list[dict]:
    """Pages for each tradeline bureau, matched by that bureau's account number.

    Creditor-name guesses are not used. A page that names a different bureau is
    not attached. Score, FICO, and "what's hurting" pages are skipped.
    """
    selected: list[dict] = []
    seen: set[tuple[int, str, str]] = set()
    kept_pages: list[int] = []
    for tradeline in tradelines:
        for bureau, field in _BUREAU_ACCOUNT_FIELDS:
            core = account_number_core(getattr(tradeline, field, "") or "")
            if not core:
                continue
            for index, text in enumerate(page_texts, start=1):
                if is_score_summary_page(text) or not page_has_tradeline_detail(text):
                    continue
                if not page_matches_tokens(text, [core]):
                    continue
                named = page_named_bureaus(text)
                if named and bureau not in named:
                    continue
                if index not in kept_pages:
                    if len(kept_pages) >= max_pages:
                        continue
                    kept_pages.append(index)
                key = (index, bureau, tradeline.id)
                if key in seen:
                    continue
                seen.add(key)
                selected.append(
                    {
                        "page": index,
                        "bureau": bureau,
                        "tradeline_id": tradeline.id,
                        "account": core,
                    }
                )
    return selected


def _cache_evict(cache: dict, max_size: int) -> None:
    while len(cache) >= max_size and cache:
        cache.pop(next(iter(cache)), None)


def _page_jpeg_cache_key(storage_path: str, page_no: int, dpi: int) -> str:
    return f"{storage_path}\0{page_no}\0{dpi}"


def render_pdf_pages_to_jpegs(
    pdf_bytes: bytes,
    page_numbers: list[int],
    *,
    dpi: int = _DEFAULT_SCREENSHOT_DPI,
    storage_path: str = "",
) -> list[bytes]:
    """Render selected 1-based PDF pages to JPEG bytes."""
    if not pdf_bytes or not page_numbers:
        return []
    try:
        from pdf2image import convert_from_bytes
    except Exception:
        return []

    images: list[bytes] = []
    # One page at a time keeps peak memory lower on Render free tier.
    for page_no in page_numbers:
        cache_key = _page_jpeg_cache_key(storage_path, page_no, dpi) if storage_path else ""
        if cache_key:
            with _SCREENSHOT_CACHE_LOCK:
                cached = _PAGE_JPEG_CACHE.get(cache_key)
            if cached is not None:
                images.append(cached)
                continue
        try:
            pages = convert_from_bytes(
                pdf_bytes,
                dpi=dpi,
                fmt="jpeg",
                first_page=page_no,
                last_page=page_no,
                thread_count=1,
            )
        except Exception:
            continue
        for page in pages:
            buf = BytesIO()
            page.convert("RGB").save(buf, format="JPEG", quality=75)
            jpeg = buf.getvalue()
            images.append(jpeg)
            if cache_key:
                with _SCREENSHOT_CACHE_LOCK:
                    _cache_evict(_PAGE_JPEG_CACHE, _PAGE_JPEG_CACHE_MAX)
                    _PAGE_JPEG_CACHE[cache_key] = jpeg
    return images


def extract_pdf_page_texts(pdf_bytes: bytes, *, storage_path: str = "") -> list[str]:
    if not pdf_bytes:
        return []
    if storage_path:
        with _SCREENSHOT_CACHE_LOCK:
            cached = _REPORT_TEXT_CACHE.get(storage_path)
        if cached is not None:
            return list(cached)
    try:
        import pdfplumber
    except Exception:
        return []
    texts: list[str] = []
    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                texts.append(page.extract_text() or "")
    except Exception:
        return []
    if storage_path and texts:
        with _SCREENSHOT_CACHE_LOCK:
            _cache_evict(_REPORT_TEXT_CACHE, _REPORT_TEXT_CACHE_MAX)
            _REPORT_TEXT_CACHE[storage_path] = list(texts)
    return texts


def screenshot_files_for_items(
    pdf_bytes: bytes,
    items: list[LetterItem],
    *,
    max_pages: int = 6,
    storage_path: str = "",
) -> list[tuple[str, bytes]]:
    """Return enclosure tuples for disputed-account report pages."""
    if not pdf_bytes or not items:
        return []
    page_texts = extract_pdf_page_texts(pdf_bytes, storage_path=storage_path)
    if not page_texts:
        return []
    pages = select_report_pages_for_items(page_texts, items, max_pages=max_pages)
    if not pages:
        return []
    jpegs = render_pdf_pages_to_jpegs(pdf_bytes, pages, storage_path=storage_path)
    files: list[tuple[str, bytes]] = []
    for index, data in enumerate(jpegs, start=1):
        files.append((f"Account Evidence {index}.jpg", data))
    return files


def _screenshot_cache_key(session_id: str, storage_path: str, items: list[LetterItem]) -> str:
    digest = hashlib.sha1()
    # Bump when selection rules change so stale score-page caches are skipped.
    digest.update(b"account-pages-v2")
    digest.update(session_id.encode("utf-8"))
    digest.update(b"\0")
    digest.update(storage_path.encode("utf-8"))
    for item in items:
        digest.update(b"\0")
        digest.update((item.creditor or "").encode("utf-8"))
        digest.update(b"\0")
        digest.update((item.account_number or "").encode("utf-8"))
    return digest.hexdigest()


def _cache_get(key: str) -> list[tuple[str, bytes]] | None:
    with _SCREENSHOT_CACHE_LOCK:
        hit = _SCREENSHOT_CACHE.get(key)
        return list(hit) if hit is not None else None


def _cache_put(key: str, files: list[tuple[str, bytes]]) -> None:
    with _SCREENSHOT_CACHE_LOCK:
        if key not in _SCREENSHOT_CACHE and len(_SCREENSHOT_CACHE) >= _SCREENSHOT_CACHE_MAX:
            # Drop an arbitrary oldest-inserted key (CPython dict order).
            oldest = next(iter(_SCREENSHOT_CACHE))
            _SCREENSHOT_CACHE.pop(oldest, None)
        _SCREENSHOT_CACHE[key] = list(files)


def letter_dispute_items(session_id: str, letter: GeneratedLetter) -> list[LetterItem]:
    """Resolve disputed items from the saved plan, else from letter markdown."""
    try:
        from app.db import get_letter_plan

        plan_resp = get_letter_plan(session_id)
        if plan_resp:
            for plan in plan_resp.plans:
                if plan.id == letter.plan_id and plan.items:
                    return list(plan.items)
    except Exception:
        pass
    return disputed_items_from_letter_markdown(letter.markdown)


def account_evidence_payload(files: list[tuple[str, bytes]]) -> dict:
    """JSON body for the account-evidence route. JPEG pages only, no letter PDF."""
    import base64

    encoded = []
    for name, data in files:
        if not data or data[:2] != b"\xff\xd8":
            continue
        encoded.append(
            {
                "name": name or f"Account Evidence {len(encoded) + 1}.jpg",
                "jpeg_base64": base64.b64encode(data).decode("ascii"),
            }
        )
    return {"files": encoded}


def load_report_account_screenshot_files(
    session_id: str, letter: GeneratedLetter
) -> list[tuple[str, bytes]]:
    """Download the session report PDF and render pages for this letter's accounts."""
    try:
        from app.db import get_session_row
        from app.storage import download_storage_bytes

        row = get_session_row(session_id) or {}
        storage_path = (row.get("storage_path") or "").strip()
        if not storage_path.lower().endswith(".pdf"):
            return []
        items = letter_dispute_items(session_id, letter)
        if not items:
            return []
        cache_key = _screenshot_cache_key(session_id, storage_path, items)
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached
        with _SCREENSHOT_CACHE_LOCK:
            pdf_bytes = _REPORT_PDF_CACHE.get(storage_path)
        if pdf_bytes is None:
            pdf_bytes = download_storage_bytes(storage_path)
            if pdf_bytes:
                with _SCREENSHOT_CACHE_LOCK:
                    _cache_evict(_REPORT_PDF_CACHE, _REPORT_PDF_CACHE_MAX)
                    _REPORT_PDF_CACHE[storage_path] = pdf_bytes
        if not pdf_bytes:
            return []
        files = screenshot_files_for_items(pdf_bytes, items, storage_path=storage_path)
        if files:
            _cache_put(cache_key, files)
        return files
    except Exception:
        return []
