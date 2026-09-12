"""Parity fixtures shared with the Next.js unit tests."""

from __future__ import annotations

import json
from pathlib import Path

from app.models import GeneratedLetter, Tradeline
from app.services.credit_health import (
    default_inquiry_dispute_reason,
    is_negative_tradeline,
    is_recommended_dispute,
)
from app.services.letter_current import current_letters
from app.services.letter_formatter import letter_layout

FIXTURES = Path(__file__).parent / "fixtures"
CASES = json.loads((FIXTURES / "parity_cases.json").read_text(encoding="utf-8"))
SAMPLE = (FIXTURES / "letter_sample.txt").read_text(encoding="utf-8")


def _tl(case: dict) -> Tradeline:
    return Tradeline(
        id=case["id"],
        creditor=case.get("creditor", "Test"),
        status=case.get("status", ""),
        remarks=case.get("remarks", ""),
        is_collection=bool(case.get("is_collection")),
        repair_priority=case.get("repair_priority", "none"),
        item_category=case.get("item_category", ""),
        bureaus=["EXP"],
    )


def test_negative_parity_cases():
    for case in CASES["negative_cases"]:
        assert is_negative_tradeline(_tl(case)) is case["expect_negative"], case["id"]


def test_recommended_parity_cases():
    for case in CASES["recommended_cases"]:
        assert is_recommended_dispute(_tl(case)) is case["expect_recommended"], case["id"]


def test_inquiry_reason_parity():
    spec = CASES["inquiry_reason"]
    reason = default_inquiry_dispute_reason(_tl({"id": "inq", "creditor": spec["creditor"], "item_category": "inquiry"}))
    for needle in spec["expect_contains"]:
        assert needle in reason


def test_current_letters_parity():
    rows = [
        GeneratedLetter(
            id=row["id"],
            plan_id=row["plan_id"],
            title=row["title"],
            markdown="body",
            file_path=f"{row['id']}.md",
        )
        for row in CASES["current_letters"]
    ]
    listed = current_letters(rows)
    assert [row.id for row in listed] == CASES["current_letters_keep_ids"]


def test_letter_layout_shared_sample():
    layout = letter_layout(SAMPLE)
    assert layout["date"] == "September 12, 2026"
    assert any(
        block.get("variant") == "name" and block.get("text") == "JANE CONSUMER"
        for block in layout["blocks"]
    )
