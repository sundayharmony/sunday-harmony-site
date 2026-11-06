"""Pull the photographic base of each ad out of the original collage.

The collage is flattened artwork, so the photography and the graphics are baked
together. Every piece that gets rebuilt as vector (headlines, logo, badges,
buttons) is painted out of the photo here, which leaves a clean plate to sit the
editable layers on top of. Areas that stay photographic are untouched.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'source' / 'ad-collage.png'
ASSETS = ROOT / 'assets'

# Cell boundaries measured from the collage gutters.
CELLS: dict[str, tuple[int, int, int, int]] = {
    'ad1': (0, 0, 815, 686),
    'ad2': (820, 0, 1241, 686),
    'ad3': (0, 693, 425, 1226),
    'ad4': (434, 693, 815, 1226),
    'ad5': (823, 693, 1241, 1226),
}

# Regions of baked-in graphics to paint out, in each crop's own pixel space.
# Four numbers repair the whole rectangle, which is what solid shapes need. Adding
# a mode and threshold repairs only the ink inside the rectangle, which is what
# type over photography needs.
CLEAN_RECTS: dict[str, list[tuple]] = {
    'ad1': [
        (40, 8, 315, 140, 'dark'),           # logo lockup
        (18, 148, 450, 312, 'dark', 14, 55),  # headline + subhead
        (22, 318, 345, 575, 'dark'),         # feature rows
        (528, 445, 800, 555, 'light'),       # script over the blazer
        (0, 600, 815, 686),                  # navy band, button and trust row
    ],
    'ad2': [
        (92, 4, 332, 134, 'light'),          # logo lockup
        (22, 128, 402, 158, 'light'),        # nav row
        (22, 162, 402, 298, 'light', 10, 55, 8),  # headline, which carries a glow
        (22, 300, 402, 378, 'light'),        # body copy
        (24, 398, 295, 532, 'light'),        # checklist
        (22, 542, 240, 602),                 # CTA
    ],
    'ad3': [
        (105, 8, 325, 98, 'dark'),           # logo lockup
        (18, 98, 312, 218, 'dark', 14, 45),  # eyebrow + script + subhead
        (26, 218, 300, 366, 'dark'),         # checklist
        (24, 364, 280, 420),                 # CTA
    ],
    'ad4': [
        (90, 12, 295, 104, 'light'),         # logo lockup
        (62, 112, 320, 140, 'light'),        # nav row
        (55, 142, 335, 218, 'light', 14, 45),  # headline
        (24, 214, 364, 310, 'light', 12, 25, 3),  # script, drawn over the sunset
        (16, 322, 370, 428, 'light'),        # icon row + labels
        (65, 432, 320, 500),                 # CTA
    ],
    'ad5': [
        (10, 8, 205, 84, 'dark'),            # logo lockup
        (16, 86, 245, 278, 'dark', 14, 45),  # script headline + kicker
        (24, 292, 250, 426, 'dark', 14, 35),  # badge discs + labels
    ],
}

# Each ad sits on the collage with a hairline of white page around it. Those edges
# are repaired from the photography inside them, so the plate fills the artboard
# instead of showing a white seam. Left, top, right, bottom, in crop pixels.
GUTTERS: dict[str, tuple[int, int, int, int]] = {
    'ad1': (0, 0, 0, 3),
    'ad2': (4, 13, 0, 3),
    'ad3': (14, 3, 2, 0),
    'ad4': (2, 2, 3, 5),
    'ad5': (1, 3, 0, 0),
}

# Areas that are one continuous out-of-focus wash in the artwork. Once the type is
# out, these get levelled so the repaired patches and the original pixels between
# them read as a single surface instead of a grid of rectangles.
WASH_RECTS: dict[str, list[tuple[int, int, int, int]]] = {
    'ad5': [(0, 0, 252, 430)],
}

# The photo plate only needs to cover the area that stays photographic; the rest
# is hidden behind vector bands, so it is cropped away to keep files small.
VISIBLE_HEIGHT: dict[str, int] = {
    'ad3': 440,
    'ad5': 460,
}


def _pyramid_fill(rgb: np.ndarray, holes: np.ndarray) -> np.ndarray:
    """Rebuild the masked pixels from the surrounding wash, coarse level to fine.

    Every level averages only the pixels it still knows about, so a hole is
    filled from whatever surrounds it in all directions. That keeps the soft
    vertical gradients these ads sit on and, unlike a blur or a row-by-row span,
    it lands on the same values as its neighbours, so no patch edge shows up.
    """
    keep = (~holes).astype(np.float32)
    images = [rgb.astype(np.float32) * keep[..., None]]
    weights = [keep]
    while min(images[-1].shape[:2]) > 2:
        images.append(cv2.pyrDown(images[-1]))
        weights.append(cv2.pyrDown(weights[-1]))

    def normalised(level: int) -> np.ndarray:
        return images[level] / np.maximum(weights[level], 1e-6)[..., None]

    estimate = normalised(len(images) - 1)
    for level in range(len(images) - 2, -1, -1):
        height, width = images[level].shape[:2]
        coarse = cv2.resize(estimate, (width, height), interpolation=cv2.INTER_CUBIC)
        trust = np.clip(weights[level], 0.0, 1.0)[..., None]
        estimate = normalised(level) * trust + coarse * (1 - trust)
    return estimate


def _ink_mask(window: np.ndarray, mode: str, delta: int, stroke: int, grow: int) -> np.ndarray:
    """Find type in `window` by how far it stands off its own background.

    The background estimate erases features thinner than `stroke` — bright ones for
    light type, dark ones for dark type — so whatever is left standing off it by
    more than `delta` is the lettering, whatever the photograph behind it is doing.
    """
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (stroke, stroke))
    op = cv2.MORPH_OPEN if mode == 'light' else cv2.MORPH_CLOSE
    background = cv2.morphologyEx(window, op, kernel)
    lift = window.astype(int) - background.astype(int)
    ink = lift > delta if mode == 'light' else lift < -delta
    # Grow past the glyph: the flattened type carries a soft glow that has to go too.
    return cv2.dilate(ink.astype(np.uint8) * 255, np.ones((grow * 2 + 1,) * 2, np.uint8))


def _mask_for(rgb: np.ndarray, rects: list[tuple], *, feather: int) -> np.ndarray:
    """Mark the pixels to repair.

    A plain rect masks its whole area, which is what solid graphics (buttons, bands)
    need. A rect given a mode masks only the ink inside it, so the photograph
    between and around the letters survives: that is what keeps the sunset in ad 4
    and the bright wash in ad 5.
    """
    grey = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mask = np.zeros(rgb.shape[:2], np.uint8)

    for rect in rects:
        x0, y0, x1, y1 = rect[:4]
        if len(rect) == 4:
            cv2.rectangle(mask, (x0, y0), (x1, y1), 255, -1)
            continue
        mode = rect[4]
        delta = rect[5] if len(rect) > 5 else 9
        stroke = rect[6] if len(rect) > 6 else 25
        grow = rect[7] if len(rect) > 7 else 5
        patch = _ink_mask(grey[y0:y1, x0:x1], mode, delta, stroke, grow)
        mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], patch)

    # Grow the solid rects so anti-aliased edge pixels cannot bleed back in. Ink
    # masks are already grown above, and must not spread any further than that.
    solid = np.zeros_like(mask)
    for rect in rects:
        if len(rect) == 4:
            cv2.rectangle(solid, (rect[0], rect[1]), (rect[2], rect[3]), 255, -1)
    grown = cv2.dilate(solid, np.ones((feather * 2 + 1,) * 2, np.uint8))
    return np.maximum(mask, grown)


def _smooth_fill(
    rgb: np.ndarray,
    rects: list[tuple],
    *,
    feather: int = 5,
) -> np.ndarray:
    """Paint the flattened graphics out of the plate, leaving the wash behind them."""
    if not rects:
        return rgb

    mask = _mask_for(rgb, rects, feather=feather)
    # The crop keeps a hair of the collage gutter; sampling it would drag white
    # into the repair, so treat the frame as unknown too rather than as source.
    border = np.zeros_like(mask)
    border[:2, :] = border[-2:, :] = border[:, :2] = border[:, -2:] = 255
    holes = (mask | border) > 0

    filled = _pyramid_fill(rgb, holes)

    # Feather the boundary so the repair blends instead of showing a rectangle.
    alpha = cv2.GaussianBlur(holes.astype(np.float32), (0, 0), 3.0)[..., None]
    blended = filled * alpha + rgb.astype(np.float32) * (1 - alpha)
    return np.clip(blended, 0, 255).astype(np.uint8)


def _gutter_rects(slug: str, width: int, height: int) -> list[tuple]:
    left, top, right, bottom = GUTTERS.get(slug, (0, 0, 0, 0))
    rects = []
    if left:
        rects.append((0, 0, left, height))
    if top:
        rects.append((0, 0, width, top))
    if right:
        rects.append((width - right, 0, width, height))
    if bottom:
        rects.append((0, height - bottom, width, height))
    return rects


def _level_wash(
    rgb: np.ndarray,
    rects: list[tuple[int, int, int, int]],
    *,
    sigma: float = 20.0,
    feather: int = 18,
) -> np.ndarray:
    """Blur a defocused area into one smooth surface, fading out at its edges."""
    out = rgb.astype(np.float32)
    for x0, y0, x1, y1 in rects:
        patch = out[y0:y1, x0:x1]
        height, width = patch.shape[:2]
        soft = cv2.GaussianBlur(patch, (0, 0), sigma, borderType=cv2.BORDER_REFLECT)
        ramp_x = np.clip(np.minimum(np.arange(width), width - 1 - np.arange(width)) / feather, 0, 1)
        ramp_y = np.clip(np.minimum(np.arange(height), height - 1 - np.arange(height)) / feather, 0, 1)
        alpha = np.outer(ramp_y, ramp_x)[..., None]
        out[y0:y1, x0:x1] = soft * alpha + patch * (1 - alpha)
    return np.clip(out, 0, 255).astype(np.uint8)


def build_plates(scale: float = 2.0, quality: int = 92) -> dict[str, Path]:
    """Write one cleaned photographic plate per ad and return the paths."""
    ASSETS.mkdir(parents=True, exist_ok=True)
    collage = Image.open(SOURCE).convert('RGB')
    written: dict[str, Path] = {}

    for slug, box in CELLS.items():
        crop = collage.crop(box)
        height = VISIBLE_HEIGHT.get(slug)
        if height:
            crop = crop.crop((0, 0, crop.width, height))

        rects = CLEAN_RECTS.get(slug, []) + _gutter_rects(slug, crop.width, crop.height)
        cleaned = _smooth_fill(np.asarray(crop), rects)
        cleaned = _level_wash(cleaned, WASH_RECTS.get(slug, []))
        plate = Image.fromarray(cleaned)

        plate = plate.resize(
            (round(plate.width * scale), round(plate.height * scale)), Image.LANCZOS
        )
        plate = plate.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=3))

        out = ASSETS / f'{slug}-photo.jpg'
        plate.save(out, 'JPEG', quality=quality, subsampling=1, optimize=True)
        written[slug] = out

    return written


def write_masks(out_dir: Path) -> None:
    """Dump what is being painted out, tinted over the crop, for checking coverage."""
    out_dir.mkdir(parents=True, exist_ok=True)
    collage = Image.open(SOURCE).convert('RGB')
    for slug, box in CELLS.items():
        crop = np.asarray(collage.crop(box))
        rects = CLEAN_RECTS.get(slug, []) + _gutter_rects(slug, crop.shape[1], crop.shape[0])
        mask = _mask_for(crop, rects, feather=5)
        tint = crop.astype(np.float32).copy()
        tint[mask > 0] = tint[mask > 0] * 0.35 + np.array([255, 0, 128]) * 0.65
        Image.fromarray(tint.astype(np.uint8)).save(out_dir / f'{slug}-mask.png')


if __name__ == '__main__':
    import sys

    if '--mask' in sys.argv:
        write_masks(Path('/tmp/ad-masks'))
        print('masks written to /tmp/ad-masks')
    else:
        for slug, path in build_plates().items():
            print(slug, path, f'{path.stat().st_size // 1024} KB')
