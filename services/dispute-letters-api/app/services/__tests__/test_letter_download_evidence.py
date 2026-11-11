"""Letter downloads attach identity documents."""

from __future__ import annotations

from app.models import GeneratedLetter
from app.services import letter_download as mod


def test_download_uses_identity_documents(monkeypatch):
    letter = GeneratedLetter(
        id="letter-1",
        plan_id="plan",
        title="Equifax",
        markdown="body",
        file_path="x.pdf",
    )

    def fake_identity(_uuid):
        return [("Government Photo ID.jpg", b"id")]

    monkeypatch.setattr(mod, "load_application_enclosure_files", fake_identity)

    files = mod.letter_files_for_download("sess", letter, application_uuid="app-1")
    uploaded = mod.letter_files_for_download(
        "sess",
        letter,
        uploaded=[("Proof of Address.jpg", b"addr")],
        application_uuid="app-1",
    )

    assert [name for name, _ in files] == ["Government Photo ID.jpg"]
    assert [name for name, _ in uploaded] == ["Proof of Address.jpg"]
