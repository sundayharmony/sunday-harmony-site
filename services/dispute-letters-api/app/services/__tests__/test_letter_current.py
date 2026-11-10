"""Current-letter identity collapses re-generated copies without dropping distinct recipients."""

from __future__ import annotations

from app.models import GeneratedLetter, LetterItem, LetterPlan
from datetime import date

from app.services.letter_current import (
    current_letters,
    letter_display_title,
    letter_identity_key,
    letter_party_label,
    superseded_letter_ids,
)


def _letter(letter_id: str, title: str, plan_id: str) -> GeneratedLetter:
    return GeneratedLetter(
        id=letter_id,
        plan_id=plan_id,
        title=title,
        markdown="body",
        file_path=f"{letter_id}.txt",
    )


def test_three_generations_keep_latest_copy_per_recipient():
    def gen(suffix: str) -> list[GeneratedLetter]:
        return [
            _letter(f"exp-{suffix}", "Experian — 4 item(s)", "plan-exp-1"),
            _letter(f"ca-{suffix}", "CREDIT ACCEPTANCE CORP — 1 item(s)", "plan-ca"),
            _letter(f"kikoff-{suffix}", "KIKOFF LENDING LLC — 1 item(s)", "plan-kikoff"),
            _letter(f"source-{suffix}", "SOURCE RECEIVABLES — 1 item(s)", "plan-source"),
            _letter(f"verizon-{suffix}", "VERIZON WIRELESS — 1 item(s)", "plan-verizon"),
        ]

    listed = current_letters(gen("1") + gen("2") + gen("3"))
    assert [row.title for row in listed] == [
        "Experian — 4 item(s)",
        "CREDIT ACCEPTANCE CORP — 1 item(s)",
        "KIKOFF LENDING LLC — 1 item(s)",
        "SOURCE RECEIVABLES — 1 item(s)",
        "VERIZON WIRELESS — 1 item(s)",
    ]
    assert [row.id for row in listed] == ["exp-3", "ca-3", "kikoff-3", "source-3", "verizon-3"]


def test_experian_item_count_change_keeps_latest_only():
    listed = current_letters(
        [
            _letter("exp-old", "Experian — 4 item(s)", "plan-exp-old"),
            _letter("ca", "CREDIT ACCEPTANCE CORP — 1 item(s)", "plan-ca"),
            _letter("exp-new", "Experian — 15 item(s)", "plan-exp-new"),
        ]
    )
    assert [row.title for row in listed] == [
        "CREDIT ACCEPTANCE CORP — 1 item(s)",
        "Experian — 15 item(s)",
    ]


def test_distinct_recipients_are_kept():
    listed = current_letters(
        [
            _letter("exp", "Experian — 15 item(s)", "plan-exp"),
            _letter("kikoff", "KIKOFF LENDING LLC — 1 item(s)", "plan-kikoff"),
        ]
    )
    assert len(listed) == 2
    assert letter_identity_key(title=listed[0].title) != letter_identity_key(title=listed[1].title)


def test_superseded_ids_include_old_plan_uuid_for_same_recipient():
    existing = [
        _letter("exp-old", "Experian — 4 item(s)", "plan-exp-old"),
        _letter("kikoff", "KIKOFF LENDING LLC — 1 item(s)", "plan-kikoff"),
    ]
    new_plan = LetterPlan(
        id="plan-exp-new",
        letter_type="bureau_experian",
        recipient_name="Experian",
        recipient_lines=["P.O. Box 4500"],
        statute="FCRA §611",
        items=[LetterItem(tradeline_id="t1", creditor="KIKOFF", account_number="1234", bureau="EXP")],
    )
    ids = superseded_letter_ids(existing, [new_plan])
    assert ids == ["exp-old"]


def test_letter_title_is_name_bureau_date_and_round():
    title = letter_display_title(
        person_name="Jane Doe",
        party=letter_party_label("bureau_equifax", "Equifax Information Services LLC"),
        round_number=2,
        on_date=date(2026, 11, 10),
    )
    assert title == "Jane Doe - Equifax - 11-10-2026 RD 2 letter"
    furnisher = letter_display_title(
        person_name="Jane Doe",
        party=letter_party_label("furnisher", "KIKOFF LENDING LLC"),
        round_number=1,
        on_date=date(2026, 11, 10),
    )
    assert furnisher == "Jane Doe - KIKOFF LENDING LLC - 11-10-2026 RD 1 letter"


def test_new_title_replaces_older_bureau_letter():
    listed = current_letters(
        [
            _letter("exp-old", "Experian — 4 item(s)", "plan-old"),
            _letter("exp-new", "Jane Doe - Experian - 11-10-2026 RD 1 letter", "plan-new"),
            _letter("eq-2", "Jane Doe - Equifax (letter 2 of 2) - 11-10-2026 RD 1 letter", "plan-eq-2"),
        ]
    )
    assert [row.id for row in listed] == ["exp-new", "eq-2"]


def test_generate_endpoints_replace_prior_letters():
    from pathlib import Path

    jobs = Path("app/services/letter_jobs.py").read_text(encoding="utf-8")
    db = Path("app/db.py").read_text(encoding="utf-8")
    main = Path("app/main.py").read_text(encoding="utf-8")
    assert "prepare_session_letters_for_generation" in jobs
    assert "replacing_all=not plan_ids" in jobs
    assert "run_letter_job" in main
    assert "delete().eq(\"session_id\", session_id).eq(\"plan_id\", plan_id)" in db
    assert "current_letters(" in db


if __name__ == "__main__":
    test_three_generations_keep_latest_copy_per_recipient()
    test_experian_item_count_change_keeps_latest_only()
    test_distinct_recipients_are_kept()
    test_superseded_ids_include_old_plan_uuid_for_same_recipient()
    test_generate_endpoints_replace_prior_letters()
    print("letter_current tests passed")
