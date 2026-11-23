"""Each Round 2/3 letter type gets its own wording. Fake data only."""
from __future__ import annotations

import pytest

from app.models import ConsumerInfo, LetterItem, LetterPlan
from app.services.letter_generator import generate_letter

CONSUMER = ConsumerInfo(name="Jane Q Sample", dob="1990-01-01", ssn="123-45-6789", addresses=["1 Main St, Town, NJ 00000"])


def _letter(letter_type: str, recipient: str = "Experian", statute: str = "FCRA §611 (15 U.S.C. §1681i)") -> str:
    plan = LetterPlan(
        id="p1",
        letter_type=letter_type,  # type: ignore[arg-type]
        recipient_name=recipient,
        recipient_lines=["P.O. Box 4500", "Allen, TX 75013"],
        statute=statute,
        items=[LetterItem(tradeline_id="t1", creditor="SAMPLE BANK", account_number="1234****", status="Late 30 Days", balance="$500.00")],
    )
    return generate_letter(plan, CONSUMER)


@pytest.mark.parametrize(
    "letter_type,needle",
    [
        ("method_of_verification", "Request for Method of Verification"),
        ("warning_intent", "Second Notice"),
        ("reinvestigation", "Further Reinvestigation"),
        ("debt_validation", "Validation of Debt"),
        ("cfpb_complaint", "Complaint About Credit Reporting"),
    ],
)
def test_follow_up_types_have_their_own_wording(letter_type, needle):
    text = _letter(letter_type)
    assert needle in text
    assert "information you are furnishing" not in text


def test_bureau_follow_ups_address_the_bureau_not_a_furnisher():
    text = _letter("method_of_verification")
    assert "§611(a)(7)" in text
    assert "you reported them as verified" in text.replace("\n", " ") or "reported them" in text


def test_internal_recipient_tags_are_not_printed():
    text = _letter("bureau_experian", recipient="Experian (letter 1 of 2)")
    assert "letter 1 of 2" not in text
    assert "my Experian consumer report" in text.replace("\n", " ")


def test_cfpb_letter_masks_ssn():
    text = _letter("cfpb_complaint", recipient="Consumer Financial Protection Bureau (SAMPLE BANK)")
    assert "123-45-6789" not in text
    assert "6789" in text
    assert "(SAMPLE BANK)" not in text
