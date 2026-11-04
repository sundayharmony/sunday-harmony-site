"""Render a cursive signature image from the consumer's printed name."""

from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path

FONTS_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"
SIGNATURE_FONT = FONTS_DIR / "GreatVibes-Regular.ttf"


@lru_cache(maxsize=1)
def _signature_font_path() -> str | None:
    if SIGNATURE_FONT.is_file():
        return str(SIGNATURE_FONT)
    return None


def render_signature_png(name: str, *, font_size: int = 96) -> bytes | None:
    """Return a transparent PNG of ``name`` in cursive, or None if unavailable."""
    cleaned = " ".join((name or "").split()).strip()
    if not cleaned or cleaned.startswith("["):
        return None
    font_path = _signature_font_path()
    if not font_path:
        return None
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return None

    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        return None

    # Measure on a temporary canvas, then crop tightly with padding.
    probe = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    bbox = draw.textbbox((0, 0), cleaned, font=font)
    text_w = max(1, bbox[2] - bbox[0])
    text_h = max(1, bbox[3] - bbox[1])
    pad_x, pad_y = 18, 16
    image = Image.new("RGBA", (text_w + pad_x * 2, text_h + pad_y * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.text((pad_x - bbox[0], pad_y - bbox[1]), cleaned, font=font, fill=(20, 20, 20, 255))

    buf = BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()
