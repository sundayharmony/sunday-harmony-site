"""Letters always come from the local FCRA template."""

from __future__ import annotations

import asyncio

from app.models import ConsumerInfo, LetterItem, LetterPlan
from app.services.letter_generator import generate_letter_async


def _plan() -> LetterPlan:
    return LetterPlan(
        id="plan-exp",
        letter_type="bureau_experian",
        recipient_name="Experian",
        recipient_lines=["P.O. Box 4500", "Allen, TX 75013"],
        statute="FCRA §611 (15 U.S.C. §1681i)",
        items=[
            LetterItem(
                tradeline_id="t1",
                creditor="KIKOFF",
                account_number="1234",
                bureau="EXP",
                status="Collection",
                balance="$100",
                dispute_reason="Unverifiable collection.",
            )
        ],
    )


def test_letters_use_the_local_template():
    text = asyncio.run(
        generate_letter_async(_plan(), ConsumerInfo(name="Jane Consumer", addresses=["123 Main St"]))
    )
    assert "formally dispute" in text.lower()
    assert "KIKOFF" in text
