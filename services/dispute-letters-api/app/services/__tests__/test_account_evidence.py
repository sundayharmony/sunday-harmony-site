"""Account evidence is JPEG pages, not a letter PDF."""

from app.services.report_screenshots import account_evidence_payload


def test_account_evidence_payload_encodes_jpegs_only():
    payload = account_evidence_payload(
        [
            ("Account Evidence 1.jpg", b"\xff\xd8\xff\x00shot"),
            ("notes.txt", b"not a jpeg"),
        ]
    )
    assert payload["files"][0]["name"] == "Account Evidence 1.jpg"
    assert payload["files"][0]["jpeg_base64"].startswith("/9j/")
    assert len(payload["files"]) == 1


def test_account_evidence_empty_when_no_pages():
    assert account_evidence_payload([]) == {"files": []}
