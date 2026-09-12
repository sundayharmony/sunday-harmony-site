"""Letter job helpers — fail closed on empty / all-skipped runs."""

from __future__ import annotations

from pathlib import Path

from app.services.letter_job_result import empty_letters_error


def test_empty_letters_error_names_skipped_furnishers():
    message = empty_letters_error(
        [
            {"plan_id": "p1", "recipient_name": "KIKOFF LENDING LLC", "reason": "missing_address"},
            {"plan_id": "p2", "recipient_name": "SOURCE RECEIVABLES", "reason": "missing_address"},
        ]
    )
    assert "No letters generated" in message
    assert "KIKOFF LENDING LLC" in message
    assert "SOURCE RECEIVABLES" in message


def test_empty_letters_error_without_skipped():
    assert empty_letters_error([]) == "No letters were generated."


def test_generate_uses_shared_job_and_does_not_upload_txt():
    main = Path("app/main.py").read_text(encoding="utf-8")
    jobs = Path("app/services/letter_jobs.py").read_text(encoding="utf-8")
    assert "run_letter_job" in main
    assert "/internal/letters/generate/start" in main
    assert "prepare_session_letters_for_generation" in jobs
    assert "replacing_all=not plan_ids" in jobs
    assert "upload_storage_bytes" not in jobs
    assert "upload_storage_bytes" not in main
    assert ".txt" not in jobs or "Does not upload .txt" in jobs
