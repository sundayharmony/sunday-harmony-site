"""Letter formatter preview, docx, and ZIP packaging."""

from __future__ import annotations

import zipfile
from io import BytesIO

from app.services.letter_formatter import (
    letter_layout,
    letter_to_docx,
    letter_to_html,
    letter_to_pdf,
    letters_zip_bytes,
    normalize_enclosure_to_jpeg,
)

SAMPLE = """\
September 12, 2026

WIDJI SELPHIN
172MEADOWCIR AMAZON
MAY'S LANDING, NJ 08330
Date of Birth: January 1, 1990
Social Security Number: XXX-XX-1234

KIKOFF LENDING LLC
633 FOLSOM ST STE 300
SAN FRANCISCO, CA 94107

Re: Formal Dispute of Inaccurate and Unverifiable Credit Report Information, FCRA §623 (15 U.S.C. §1681s-2)

Dear Sir or Madam:

I am writing to submit a formal dispute under FCRA §623 (15 U.S.C. §1681s-2) regarding credit
reporting information furnished by Kikoff Lending LLC to Experian concerning my account.

Consumer Identification
Full Name: Widji Selphin
Date of Birth: January 1, 1990
Social Security Number: XXX-XX-1234

Disputed Tradelines
● Kikoff Lending LLC, Account Number: ****1234
"""


def test_layout_puts_date_in_header_not_body():
    layout = letter_layout(SAMPLE)
    assert layout["date"] == "September 12, 2026"
    body_text = "\n".join(block.get("text", "") for block in layout["blocks"] if block["kind"] != "spacer")
    assert "September 12, 2026" not in body_text
    assert any(block.get("variant") == "name" and block.get("text") == "WIDJI SELPHIN" for block in layout["blocks"])
    assert any(block.get("variant") == "heading" and block.get("text") == "Consumer Identification" for block in layout["blocks"])
    assert any(
        block.get("variant") == "field" and str(block.get("text", "")).startswith("Full Name:")
        for block in layout["blocks"]
    )
    assert any(
        block.get("variant") == "field"
        and str(block.get("text", "")).startswith("Social Security Number:")
        for block in layout["blocks"]
    )
    assert any(block["kind"] == "bullet" for block in layout["blocks"])


def test_html_mirrors_header_and_skips_body_date():
    html = letter_to_html(SAMPLE)
    assert html.count("September 12, 2026") == 1
    assert 'class="letter-header-date">September 12, 2026</span>' in html
    assert "Page 1/1" in html
    assert "WIDJI SELPHIN" in html
    assert "letter-heading" in html
    assert "letter-bullet" in html


def test_docx_header_contains_date_and_page_fields():
    document = letter_to_docx(SAMPLE)
    xml = document.sections[0].header._element.xml
    assert "September 12, 2026" in xml
    assert "PAGE" in xml
    assert "NUMPAGES" in xml
    assert "right" in xml.lower()
    body_text = "\n".join(p.text for p in document.paragraphs)
    assert "September 12, 2026" not in body_text
    assert "WIDJI SELPHIN" in body_text


def test_zip_contains_only_pdf():
    payload = letters_zip_bytes(
        [
            ("Experian — 4 item(s)", SAMPLE),
            ("KIKOFF LENDING LLC — 1 item(s)", SAMPLE),
        ]
    )
    with zipfile.ZipFile(BytesIO(payload)) as zf:
        names = zf.namelist()
        bodies = [zf.read(name) for name in names]
    assert names == [
        "Experian — 4 item(s).pdf",
        "KIKOFF LENDING LLC — 1 item(s).pdf",
    ]
    assert all(name.endswith(".pdf") for name in names)
    assert all(body.startswith(b"%PDF") for body in bodies)
    assert not any(name.endswith(".txt") for name in names)
    assert not any("/" in name for name in names)


def test_pdf_contains_date_and_enclosures():
    sample = (
        SAMPLE
        + "\n\nRespectfully,\n\nJane Consumer\n\nEnclosures\n"
        + "● Copy of government-issued photo identification\n"
        + "● Proof of current residential address\n"
        + "● Screenshots of the disputed account(s) from my consumer credit report\n"
    )
    payload = letter_to_pdf(
        sample,
        enclosure_files=[("Government Photo ID.png", MINI_PNG), ("Proof of Address.png", MINI_PNG)],
    )
    assert payload.startswith(b"%PDF")
    assert len(payload) > 2000
    # Enclosure images are re-encoded as JPEG and embedded as XObjects.
    assert b"/XObject" in payload
    assert b"/DCTDecode" in payload


def test_normalize_enclosure_rejects_garbage():
    assert normalize_enclosure_to_jpeg(b"not-an-image") is None
    assert normalize_enclosure_to_jpeg(MINI_PNG)[:2] == b"\xff\xd8"


MINI_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_docx_embeds_identity_images_at_end():
    sample = (
        SAMPLE
        + "\n\nRespectfully,\n\nJane Consumer\n\nEnclosures\n"
        + "● Copy of government-issued photo identification\n"
        + "● Proof of current residential address\n"
    )
    document = letter_to_docx(
        sample,
        enclosure_files=[("Government Photo ID.png", MINI_PNG), ("Proof of Address.png", MINI_PNG)],
    )
    # Cursive signature image + two enclosure identity images.
    assert len(document.inline_shapes) == 3
    text = "\n".join(p.text for p in document.paragraphs)
    assert "Enclosures" in text
    assert "photo identification" not in text.lower()
    layout = letter_layout(sample)
    assert any(block.get("variant") == "closing" for block in layout["blocks"])
    assert any(block.get("variant") == "signature" for block in layout["blocks"])


def test_html_marks_closing_and_page_counter():
    html = letter_to_html(SAMPLE + "\n\nRespectfully,\n\nJane Consumer\n")
    assert "letter-closing" in html
    assert 'class="letter-header-page">Page 1/1</span>' in html


def test_layout_marks_name_after_closing_as_signature():
    layout = letter_layout(SAMPLE + "\n\nRespectfully,\n\nJane Consumer\n\nEnclosures\n")
    variants = [
        (block.get("variant"), block.get("text"))
        for block in layout["blocks"]
        if block.get("kind") == "line"
    ]
    assert ("closing", "Respectfully,") in variants
    assert ("signature", "Jane Consumer") in variants
    assert ("heading", "Enclosures") in variants


def test_docx_embeds_cursive_signature_image():
    sample = SAMPLE + "\n\nRespectfully,\n\nJane Consumer\n\nEnclosures\n"
    document = letter_to_docx(sample)
    assert len(document.inline_shapes) >= 1
    texts = [p.text for p in document.paragraphs]
    assert "Respectfully," in texts
    # Typed name stays on the left; cursive image sits in the right cell.
    assert any(table.rows[0].cells[0].text == "Jane Consumer" for table in document.tables)
    html = letter_to_html(sample)
    assert "letter-signoff-row" in html
    assert "letter-signatory-name" in html
    assert "letter-signature" in html
    assert "Jane Consumer" in html
