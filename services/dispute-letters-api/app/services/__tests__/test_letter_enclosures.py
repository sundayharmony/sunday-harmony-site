"""Dispute letters always list photo ID and proof of address as enclosures."""

from __future__ import annotations

from app.models import ConsumerInfo, LetterItem, LetterPlan
from app.services.letter_formatter import letter_layout, replace_letter_sentence_dashes
from app.services.letter_generator import (
    _template_fallback,
    build_letter_prompt,
    compose_basis_of_dispute,
)


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


def test_compose_basis_does_not_stack_duplicate_dispute_openers():
    reason = (
        "Pursuant to FCRA §611 (15 U.S.C. §1681i), I dispute this tradeline as inaccurate "
        "and unverifiable. Under FCRA §611 (15 U.S.C. §1681i), request Experian delete this "
        "charge-off tradeline if the furnisher cannot verify complete and accurate reporting. "
        "Request deletion of the entire tradeline rather than cosmetic correction. Direct "
        "furnisher investigation under FCRA §623 (15 U.S.C. §1681s-2). Because this account "
        "is reported as Charge Off; Closed and does not support a clean credit profile, I "
        "specifically request that Experian delete the entire tradeline if the furnisher "
        "cannot verify every reported field. Obtain verification from the furnisher pursuant "
        "to FCRA §623 (15 U.S.C. §1681s-2)."
    )
    basis = compose_basis_of_dispute(
        recipient="Experian",
        statute="FCRA §611 (15 U.S.C. §1681i)",
        status="Charge Off; Closed",
        reason=reason,
    )
    assert basis.lower().count("i dispute this tradeline as inaccurate and unverifiable") == 1
    assert "clean credit profile" not in basis.lower()
    assert basis.lower().count("obtain verification from the furnisher") <= 1
    assert "U.S.C." in basis
    assert "U. S. C." not in basis
    # Second §611 lead-in is stripped; substance of the delete ask remains once.
    assert basis.lower().count("fcra §611") == 1
    # Template must use the composed basis, not prepend another opener.
    plan = _plan()
    plan.items[0].dispute_reason = reason
    plan.items[0].status = "Charge Off; Closed"
    text = _template_fallback(plan, ConsumerInfo(name="Jane Consumer", addresses=["123 Main St"]))
    assert text.lower().count("i dispute this tradeline as inaccurate and unverifiable") == 1
    assert "does not support a clean credit profile" not in text.lower()


def test_template_lists_photo_id_and_address_enclosures():
    text = _template_fallback(_plan(), ConsumerInfo(name="Jane Consumer", addresses=["123 Main St"]))
    assert "Enclosures" in text
    assert "government-issued photo identification" in text
    assert "Proof of current residential address" in text
    assert "Screenshots of the disputed account" not in text
    assert "score" not in text.lower().split("enclosures", 1)[-1]
    layout = letter_layout(text)
    assert any(block.get("variant") == "heading" and block.get("text") == "Enclosures" for block in layout["blocks"])
    bullets = [block.get("text", "") for block in layout["blocks"] if block["kind"] == "bullet"]
    assert any("photo identification" in bullet for bullet in bullets)
    assert any("residential address" in bullet for bullet in bullets)
    assert all("screenshot" not in bullet.lower() for bullet in bullets)


def test_template_keeps_dob_and_ssn_in_consumer_identification():
    text = _template_fallback(
        _plan(),
        ConsumerInfo(
            name="Jane Consumer",
            addresses=["123 Main St\nSpringfield, IL 62701"],
            dob="January 15, 1988",
            ssn="123456789",
            ssn_last4="6789",
        ),
    )
    header_end = text.index("Experian")
    opening = text[:header_end]
    assert "JANE CONSUMER" in opening
    assert "Date of Birth:" not in opening
    assert "Social Security Number:" not in opening
    identified = text.split("Consumer Identification", 1)[1]
    assert "Date of Birth: January 15, 1988" in identified
    assert "Social Security Number: 123-45-6789" in identified
    layout = letter_layout(text)
    fields = [
        block.get("text", "")
        for block in layout["blocks"]
        if block.get("variant") == "field"
    ]
    assert any(f.startswith("Date of Birth:") for f in fields)
    assert any(f.startswith("Social Security Number: 123-45-6789") for f in fields)


def test_template_falls_back_to_masked_last4_without_full_ssn():
    text = _template_fallback(
        _plan(),
        ConsumerInfo(
            name="Jane Consumer",
            addresses=["123 Main St"],
            dob="January 15, 1988",
            ssn_last4="6789",
        ),
    )
    assert "Social Security Number: XXX-XX-6789" in text


def test_prompt_requires_identity_enclosures():
    prompt = build_letter_prompt(_plan(), ConsumerInfo(name="Jane Consumer"))
    assert "Enclosures" in prompt
    assert "government-issued photo identification" in prompt
    assert "Proof of current residential address" in prompt
    assert "Screenshots of the disputed account" not in prompt
    assert "Do NOT mention account screenshots" in prompt
    assert "Do NOT use em dashes" in prompt
    assert "Date of Birth" in prompt
    assert "Social Security Number" in prompt
    assert "only in the Consumer Identification section" in prompt


def test_template_and_cleanup_drop_sentence_em_dashes():
    text = _template_fallback(_plan(), ConsumerInfo(name="Jane Consumer", addresses=["123 Main St"]))
    assert "—" not in text
    assert "–" not in text
    cleaned = replace_letter_sentence_dashes(
        "For each tradeline identified above—especially collections, charge-offs, and closed "
        "accounts—I request deletion. Closed negatives — these do not help. "
        "Keep FCRA §611(a)(6)–(7) and FCRA §616–§617. Charge-off wording stays. "
        "Profile - I also dispute the dates. Late history— I want deletion."
    )
    leftover = cleaned.replace("§611(a)(6)–(7)", "").replace("§616–§617", "")
    assert "—" not in leftover
    assert "–" not in leftover
    assert "above, especially" in cleaned
    assert "accounts. I request" in cleaned
    assert "negatives, these" in cleaned
    assert "§611(a)(6)–(7)" in cleaned
    assert "§616–§617" in cleaned
    assert "charge-off" in cleaned
    assert "Profile. I also" in cleaned
    assert "history. I want" in cleaned
    re_line = replace_letter_sentence_dashes(
        "Re: Formal Dispute of Inaccurate and Unverifiable Credit Report Information – FCRA §611 (15 U.S.C. §1681i)"
    )
    assert "—" not in re_line and "–" not in re_line
    assert "Information, FCRA" in re_line
    stored = letter_layout(
        "September 12, 2026\n\nJANE CONSUMER\n\nDear Sir or Madam:\n\n"
        "Closed negatives — these do not help. Keep FCRA §611(a)(6)–(7).\n"
    )
    texts = "\n".join(str(block.get("text") or "") for block in stored["blocks"])
    assert "—" not in texts
    assert "negatives, these" in texts
    assert "§611(a)(6)–(7)" in texts
