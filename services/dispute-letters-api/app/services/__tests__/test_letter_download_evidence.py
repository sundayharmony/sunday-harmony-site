"""Interactive downloads can skip expensive account-evidence screenshots."""

from __future__ import annotations

from app.models import GeneratedLetter
from app.services import letter_download as mod


def test_include_evidence_false_skips_screenshots(monkeypatch):
    letter = GeneratedLetter(
        id="letter-1",
        plan_id="plan",
        title="Equifax",
        markdown="body",
        file_path="x.pdf",
    )
    calls = {"shots": 0, "identity": 0}

    def fake_identity(_uuid):
        calls["identity"] += 1
        return [("Government Photo ID.jpg", b"id")]

    def fake_shots(_session_id, _letter):
        calls["shots"] += 1
        return [("Account Evidence 1.jpg", b"shot")]

    monkeypatch.setattr(mod, "load_application_enclosure_files", fake_identity)
    monkeypatch.setattr(mod, "load_report_account_screenshot_files", fake_shots)

    with_evidence = mod.letter_files_for_download(
        "sess", letter, include_evidence=True, application_uuid="app-1"
    )
    without = mod.letter_files_for_download(
        "sess", letter, include_evidence=False, application_uuid="app-1"
    )

    assert [name for name, _ in with_evidence] == [
        "Government Photo ID.jpg",
        "Account Evidence 1.jpg",
    ]
    assert [name for name, _ in without] == ["Government Photo ID.jpg"]
    assert calls["shots"] == 1
    assert calls["identity"] == 2
