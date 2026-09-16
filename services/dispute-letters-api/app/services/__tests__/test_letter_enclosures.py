"""Dispute letters always list photo ID and proof of address as enclosures."""

from __future__ import annotations

from app.models import ConsumerInfo, LetterItem, LetterPlan
from app.services.letter_formatter import letter_layout
from app.services.letter_generator import _template_fallback, build_letter_prompt


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


def test_template_lists_photo_id_and_address_enclosures():
    text = _template_fallback(_plan(), ConsumerInfo(name="Jane Consumer", addresses=["123 Main St"]))
    assert "Enclosures" in text
    assert "government-issued photo identification" in text
    assert "Proof of current residential address" in text
    layout = letter_layout(text)
    assert any(block.get("variant") == "heading" and block.get("text") == "Enclosures" for block in layout["blocks"])
    bullets = [block.get("text", "") for block in layout["blocks"] if block["kind"] == "bullet"]
    assert any("photo identification" in bullet for bullet in bullets)
    assert any("residential address" in bullet for bullet in bullets)


def test_prompt_requires_identity_enclosures():
    prompt = build_letter_prompt(_plan(), ConsumerInfo(name="Jane Consumer"))
    assert "Enclosures" in prompt
    assert "government-issued photo identification" in prompt
    assert "Proof of current residential address" in prompt
