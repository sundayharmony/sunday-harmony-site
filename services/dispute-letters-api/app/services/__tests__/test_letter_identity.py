from app.services.letter_identity import pick_letter_identity_docs


def test_pick_prefers_proof_of_address_and_keeps_photo_ids():
    selected = pick_letter_identity_docs(
        [
            {"id": "1", "document_type": "photo_id", "storage_path": "id-front.jpg", "scan_status": "clean"},
            {"id": "2", "document_type": "photo_id", "storage_path": "id-back.jpg", "scan_status": "clean"},
            {"id": "3", "document_type": "mail_proof", "storage_path": "mail.jpg", "scan_status": "clean"},
            {"id": "4", "document_type": "proof_of_address", "storage_path": "lease.jpg", "scan_status": "clean"},
            {"id": "5", "document_type": "selfie_with_id", "storage_path": "selfie.jpg", "scan_status": "clean"},
            {"id": "6", "document_type": "ssn_card", "storage_path": "ssn.jpg", "scan_status": "clean"},
        ]
    )
    assert [doc["storage_path"] for doc in selected] == [
        "id-front.jpg",
        "id-back.jpg",
        "lease.jpg",
        "ssn.jpg",
    ]


def test_pick_skips_rejected_and_falls_back_to_mail_proof():
    selected = pick_letter_identity_docs(
        [
            {"id": "1", "document_type": "photo_id", "storage_path": "bad.jpg", "scan_status": "rejected"},
            {"id": "2", "document_type": "photo_id", "storage_path": "good.jpg", "scan_status": "clean"},
            {"id": "3", "document_type": "mail_proof", "storage_path": "mail.jpg", "scan_status": "clean"},
        ]
    )
    assert [doc["storage_path"] for doc in selected] == ["good.jpg", "mail.jpg"]


def test_pick_prefers_letter_working_copy_over_original():
    original_id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    selected = pick_letter_identity_docs(
        [
            {
                "id": original_id,
                "document_type": "photo_id",
                "storage_path": f"apps/{original_id}/photo.jpg",
                "scan_status": "clean",
                "created_at": "2026-01-01T00:00:00Z",
            },
            {
                "id": "copy-1",
                "document_type": "photo_id",
                "storage_path": f"apps/x/letter-current_{original_id}_cropped.jpg",
                "scan_status": "clean",
                "created_at": "2026-01-02T00:00:00Z",
            },
            {
                "id": "addr",
                "document_type": "proof_of_address",
                "storage_path": "lease.jpg",
                "scan_status": "clean",
            },
        ]
    )
    assert [doc["storage_path"] for doc in selected] == [
        f"apps/x/letter-current_{original_id}_cropped.jpg",
        "lease.jpg",
    ]
