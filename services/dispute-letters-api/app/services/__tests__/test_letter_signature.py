from app.services.letter_formatter import letter_to_pdf
from app.services.letter_signature import SIGNATURE_FONT, render_signature_png


def test_signature_font_is_packaged():
    assert SIGNATURE_FONT.is_file(), f"Missing cursive font at {SIGNATURE_FONT}"


def test_render_signature_png_returns_png_bytes():
    png = render_signature_png("Jane Consumer")
    assert png is not None
    assert png.startswith(b"\x89PNG\r\n\x1a\n")


def test_render_signature_png_skips_placeholders():
    assert render_signature_png("[Your Name]") is None
    assert render_signature_png("   ") is None


def test_pdf_embeds_cursive_signature_image():
    sample = (
        "September 12, 2026\n\nJANE CONSUMER\n123 MAIN ST\n\nEXPERIAN\n\n"
        "Re: Formal Dispute\n\nDear Sir or Madam:\n\nI dispute.\n\n"
        "Respectfully,\n\nJane Consumer\n\nEnclosures\n"
    )
    png = render_signature_png("Jane Consumer")
    assert png is not None
    payload = letter_to_pdf(sample)
    assert payload.startswith(b"%PDF")
    # Signature image should be present as an XObject (not italic text only).
    assert b"/XObject" in payload
    assert b"/Image" in payload
    assert len(payload) > len(png)
