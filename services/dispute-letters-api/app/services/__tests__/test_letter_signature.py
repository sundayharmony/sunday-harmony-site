from app.services.letter_signature import render_signature_png


def test_render_signature_png_returns_png_bytes():
    png = render_signature_png("Jane Consumer")
    assert png is not None
    assert png.startswith(b"\x89PNG\r\n\x1a\n")


def test_render_signature_png_skips_placeholders():
    assert render_signature_png("[Your Name]") is None
    assert render_signature_png("   ") is None
