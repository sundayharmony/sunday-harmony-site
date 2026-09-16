"""Letter formatter preview, docx, and ZIP packaging."""

from __future__ import annotations

import zipfile
from io import BytesIO

from app.services.letter_formatter import letter_layout, letter_to_docx, letter_to_html, letters_zip_bytes

SAMPLE = """\
September 12, 2026

WIDJI SELPHIN
172MEADOWCIR AMAZON
MAY'S LANDING, NJ 08330

KIKOFF LENDING LLC
633 FOLSOM ST STE 300
SAN FRANCISCO, CA 94107

Re: Formal Dispute of Inaccurate and Unverifiable Credit Report Information – FCRA §623 (15 U.S.C. §1681s-2)

Dear Sir or Madam:

I am writing to submit a formal dispute under FCRA §623 (15 U.S.C. §1681s-2) regarding credit
reporting information furnished by Kikoff Lending LLC to Experian concerning my account.

Consumer Identification
Full Name: Widji Selphin
Date of Birth: January 1, 1990

Disputed Tradelines
● Kikoff Lending LLC — Account Number: ****1234
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


def test_zip_contains_only_docx():
    payload = letters_zip_bytes(
        [
            ("Experian — 4 item(s)", SAMPLE),
            ("KIKOFF LENDING LLC — 1 item(s)", SAMPLE),
        ]
    )
    with zipfile.ZipFile(BytesIO(payload)) as zf:
        names = zf.namelist()
    assert names == [
        "Experian — 4 item(s).docx",
        "KIKOFF LENDING LLC — 1 item(s).docx",
    ]
    assert all(name.endswith(".docx") for name in names)
    assert not any(name.endswith(".txt") for name in names)
    assert not any("/" in name for name in names)


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
    assert len(document.inline_shapes) == 2
    text = "\n".join(p.text for p in document.paragraphs)
    assert "Enclosures" in text
    assert "photo identification" not in text.lower()
    layout = letter_layout(sample)
    assert any(block.get("variant") == "closing" for block in layout["blocks"])


def test_html_marks_closing_and_page_counter():
    html = letter_to_html(SAMPLE + "\n\nRespectfully,\n\nJane Consumer\n")
    assert "letter-closing" in html
    assert 'class="letter-header-page">Page 1/1</span>' in html
