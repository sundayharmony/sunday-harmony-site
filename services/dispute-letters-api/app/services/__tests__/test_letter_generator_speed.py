"""Letters use the local template unless the agent is explicitly enabled."""

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


def test_letters_skip_the_agent_even_when_the_api_key_is_set(monkeypatch):
    monkeypatch.setenv("CURSOR_API_KEY", "test-key")
    monkeypatch.delenv("DISPUTE_LETTER_AGENT", raising=False)

    async def _agent(_prompt: str) -> str:
        raise AssertionError("agent should not run for the default letter path")

    monkeypatch.setattr("app.services.letter_generator._generate_via_sdk_async", _agent)
    text = asyncio.run(
        generate_letter_async(_plan(), ConsumerInfo(name="Jane Consumer", addresses=["123 Main St"]))
    )
    assert "formally dispute" in text.lower()
    assert "KIKOFF" in text


def test_enabled_agent_falls_back_when_it_times_out(monkeypatch):
    monkeypatch.setenv("CURSOR_API_KEY", "test-key")
    monkeypatch.setenv("DISPUTE_LETTER_AGENT", "1")
    monkeypatch.setenv("DISPUTE_LETTER_AGENT_TIMEOUT_SEC", "3")

    async def _agent(_prompt: str) -> str:
        await asyncio.sleep(30)
        return "should not be used"

    monkeypatch.setattr("app.services.letter_generator._generate_via_sdk_async", _agent)
    text = asyncio.run(
        generate_letter_async(_plan(), ConsumerInfo(name="Jane Consumer", addresses=["123 Main St"]))
    )
    assert "KIKOFF" in text
    assert "should not be used" not in text
