"""Keep one current letter per recipient/plan so re-generation does not accumulate copies."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterable, Sequence, TypeVar
from zoneinfo import ZoneInfo

from app.models import GeneratedLetter, LetterPlan

_ITEM_COUNT_SUFFIX = re.compile(r"\s+[—–-]\s+\d+\s+item\(s\)\s*$", re.IGNORECASE)
_RD_TITLE = re.compile(
    r"^(?P<name>.+?) - (?P<party>.+?) - (?P<date>\d{1,2}-\d{1,2}-\d{4}) RD (?P<round>\d+) letter$",
    re.IGNORECASE,
)
_CHUNK_SUFFIX = re.compile(r"\(letter \d+ of \d+\)\s*$", re.IGNORECASE)
_BUREAU_LABELS = (
    ("transunion", "TransUnion"),
    ("experian", "Experian"),
    ("equifax", "Equifax"),
)
_EASTERN = ZoneInfo("America/New_York")

T = TypeVar("T")


def _clean_title_part(value: str, fallback: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', " ", value or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned or fallback


def bureau_short_name(value: str) -> str:
    """Equifax / Experian / TransUnion, keeping a chunk suffix when a bureau is split."""
    text = _ITEM_COUNT_SUFFIX.sub("", (value or "").strip()).strip()
    if not text:
        return ""
    chunk = ""
    match = _CHUNK_SUFFIX.search(text)
    if match:
        chunk = " " + match.group(0).strip()
    folded = text.casefold()
    for needle, label in _BUREAU_LABELS:
        if needle in folded:
            return f"{label}{chunk}"
    return ""


def letter_party_label(letter_type: str, recipient_name: str) -> str:
    """Bureau letters use the bureau name. Other letters keep the recipient."""
    short = bureau_short_name(recipient_name) or bureau_short_name(letter_type or "")
    if (letter_type or "").startswith("bureau_") and short:
        return short
    if (letter_type or "").startswith("bureau_"):
        return {"bureau_equifax": "Equifax", "bureau_experian": "Experian", "bureau_transunion": "TransUnion"}.get(
            letter_type, "Bureau"
        )
    return _clean_title_part(recipient_name, "Letter")


def letter_display_title(
    *,
    person_name: str,
    party: str,
    round_number: int,
    on_date: date | None = None,
) -> str:
    """Person, bureau (or other recipient), date, and round. Example: Jane Doe Experian 11-10-2026 RD 1 letter."""
    name = _clean_title_part(person_name, "Client")
    who = _clean_title_part(party, "Letter")
    moment = on_date or datetime.now(_EASTERN).date()
    stamp = f"{moment.month}-{moment.day}-{moment.year}"
    round_n = max(1, int(round_number or 1))
    return f"{name} - {who} - {stamp} RD {round_n} letter"


def _title_party(title: str) -> str:
    match = _RD_TITLE.match((title or "").strip())
    if not match:
        return ""
    return match.group("party").strip()


def letter_identity_key(*, plan_id: str = "", title: str = "", recipient_name: str = "", letter_id: str = "") -> str:
    raw = (recipient_name or title or "").strip()
    party = "" if recipient_name else _title_party(title)
    recipient = party or _ITEM_COUNT_SUFFIX.sub("", raw).strip()
    if recipient:
        return f"recipient:{recipient.casefold()}"
    plan = (plan_id or "").strip()
    if plan:
        return f"plan:{plan}"
    return f"title:{(title or letter_id or 'letter').strip().casefold()}"


def letter_identity_keys(*, plan_id: str = "", title: str = "", recipient_name: str = "", letter_id: str = "") -> list[str]:
    keys = {
        letter_identity_key(plan_id=plan_id, title=title, recipient_name=recipient_name, letter_id=letter_id)
    }
    plan = (plan_id or "").strip()
    if plan:
        keys.add(f"plan:{plan}")
    short = bureau_short_name(recipient_name or _title_party(title) or title)
    if short:
        keys.add(f"recipient:{short.casefold()}")
    return list(keys)


def current_letters(letters: Sequence[GeneratedLetter]) -> list[GeneratedLetter]:
    """Letters must be oldest-first. Returns the latest letter per recipient/plan."""
    surviving: dict[str, GeneratedLetter] = {}
    occupant: dict[str, str] = {}

    for letter in letters:
        keys = letter_identity_keys(plan_id=letter.plan_id, title=letter.title, letter_id=letter.id)
        evict: set[str] = set()
        for key in keys:
            existing_id = occupant.get(key)
            if existing_id:
                evict.add(existing_id)
        for existing_id in evict:
            previous = surviving.pop(existing_id, None)
            if not previous:
                continue
            for key in letter_identity_keys(
                plan_id=previous.plan_id, title=previous.title, letter_id=previous.id
            ):
                if occupant.get(key) == existing_id:
                    del occupant[key]
        surviving[letter.id] = letter
        for key in keys:
            occupant[key] = letter.id

    keep = set(surviving)
    return [letter for letter in letters if letter.id in keep]


def superseded_letter_ids(existing: Sequence[GeneratedLetter], plans: Iterable[LetterPlan]) -> list[str]:
    """Prior rows replaced by generating these plans (same plan id or same recipient)."""
    plan_list = list(plans)
    plan_ids = {plan.id for plan in plan_list}
    keys = set()
    for plan in plan_list:
        keys.update(
            letter_identity_keys(
                plan_id=plan.id,
                recipient_name=plan.recipient_name,
                title=f"{plan.recipient_name} — {len(plan.items)} item(s)",
            )
        )
    ids: list[str] = []
    seen: set[str] = set()
    for letter in existing:
        letter_keys = letter_identity_keys(plan_id=letter.plan_id, title=letter.title, letter_id=letter.id)
        if letter.plan_id in plan_ids or keys.intersection(letter_keys):
            if letter.id not in seen:
                seen.add(letter.id)
                ids.append(letter.id)
    return ids
