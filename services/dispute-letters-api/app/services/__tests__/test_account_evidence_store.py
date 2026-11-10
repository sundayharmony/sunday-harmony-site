"""Account-page images are stored once and recorded even when rendering fails."""

from app.models import ParsedReport, Tradeline
from app.services import account_evidence_store as store


def test_store_uploads_one_jpeg_per_page_and_records_manifest(monkeypatch):
    uploads: list[tuple[str, bytes, str]] = []

    def fake_upload(path, content, content_type):
        uploads.append((path, content, content_type))

    monkeypatch.setattr(store, "render_pdf_file_pages", lambda path, pages, dpi=100: {2: b"\xff\xd8\xff"})

    report = ParsedReport(
        tradelines=[
            Tradeline(id="disc", creditor="DISCOVER", account_eqf="601100XXXXXX"),
        ]
    )
    pages = [
        "FICO What's hurting",
        "Equifax DISCOVER Account Number 601100XXXXXX Payment History Reported Status",
    ]
    manifest = store.store_account_evidence(
        "11111111-1111-1111-1111-111111111111",
        report,
        "/tmp/report.pdf",
        pages,
        upload=fake_upload,
    )
    assert manifest["attempted"] is True
    assert manifest["missing"] is False
    assert manifest["pages"] == [
        {
            "page": 2,
            "bureau": "EQF",
            "tradeline_id": "disc",
            "path": "sessions/11111111-1111-1111-1111-111111111111/evidence/page-2.jpg",
            "account": "601100",
        }
    ]
    jpeg_uploads = [item for item in uploads if item[2] == "image/jpeg"]
    assert len(jpeg_uploads) == 1
    assert uploads[-1][2] == "application/json"


def test_store_records_attempt_when_render_returns_nothing(monkeypatch):
    uploads: list[tuple[str, bytes, str]] = []

    monkeypatch.setattr(store, "render_pdf_file_pages", lambda path, pages, dpi=100: {})

    report = ParsedReport(
        tradelines=[Tradeline(id="disc", creditor="DISCOVER", account_eqf="601100XXXXXX")]
    )
    pages = ["Equifax DISCOVER Account Number 601100XXXXXX Payment History Reported Status"]
    manifest = store.store_account_evidence(
        "11111111-1111-1111-1111-111111111111",
        report,
        "/tmp/report.pdf",
        pages,
        upload=lambda path, content, content_type: uploads.append((path, content, content_type)),
    )
    assert manifest["attempted"] is True
    assert manifest["missing"] is True
    assert manifest["pages"] == []
    assert uploads[-1][0].endswith("manifest.json")


def test_ensure_skips_when_manifest_already_exists(monkeypatch):
    called = {"store": 0}
    monkeypatch.setattr(
        store,
        "read_account_evidence_manifest",
        lambda session_id: {"attempted": True, "missing": False, "pages": []},
    )

    def fail_store(*_args, **_kwargs):
        called["store"] += 1
        raise AssertionError("store should not run")

    monkeypatch.setattr(store, "store_account_evidence", fail_store)
    result = store.ensure_account_evidence("11111111-1111-1111-1111-111111111111")
    assert result["attempted"] is True
    assert called["store"] == 0
