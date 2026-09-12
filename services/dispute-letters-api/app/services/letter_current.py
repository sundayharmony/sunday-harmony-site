"""Keep one current letter per recipient/plan so re-generation does not accumulate copies."""

from __future__ import annotations

import re
from typing import Iterable, Sequence, TypeVar

from app.models import GeneratedLetter, LetterPlan

_ITEM_COUNT_SUFFIX = re.compile(r"\s+[—–-]\s+\d+\s+item\(s\)\s*$", re.IGNORECASE)

T = TypeVar("T")


def letter_identity_key(*, plan_id: str = "", title: str = "", recipient_name: str = "", letter_id: str = "") -> str:
    raw = (recipient_name or title or "").strip()
    recipient = _ITEM_COUNT_SUFFIX.sub("", raw).strip()
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
