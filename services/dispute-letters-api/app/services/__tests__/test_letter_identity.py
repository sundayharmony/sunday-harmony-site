from app.services.letter_identity import pick_letter_identity_docs


def test_pick_prefers_proof_of_address_and_keeps_photo_ids():
    selected = pick_letter_identity_docs(
        [
            {"document_type": "photo_id", "storage_path": "id-front.jpg", "scan_status": "clean"},
            {"document_type": "photo_id", "storage_path": "id-back.jpg", "scan_status": "clean"},
            {"document_type": "mail_proof", "storage_path": "mail.jpg", "scan_status": "clean"},
            {"document_type": "proof_of_address", "storage_path": "lease.jpg", "scan_status": "clean"},
            {"document_type": "selfie_with_id", "storage_path": "selfie.jpg", "scan_status": "clean"},
        ]
    )
    assert [doc["storage_path"] for doc in selected] == ["id-front.jpg", "id-back.jpg", "lease.jpg"]


def test_pick_skips_rejected_and_falls_back_to_mail_proof():
    selected = pick_letter_identity_docs(
        [
            {"document_type": "photo_id", "storage_path": "bad.jpg", "scan_status": "rejected"},
            {"document_type": "photo_id", "storage_path": "good.jpg", "scan_status": "clean"},
            {"document_type": "mail_proof", "storage_path": "mail.jpg", "scan_status": "clean"},
        ]
    )
    assert [doc["storage_path"] for doc in selected] == ["good.jpg", "mail.jpg"]
