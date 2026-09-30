"""Sunday Harmony ad kit: palette, type, and the vector elements shared by every ad.

Coordinates are always in artboard units (the SVG viewBox), which match the pixel
grid of the original collage crop for that ad. Output size is set separately, so
the same numbers drive both the SVG artboard and the rasterised PSD layers.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from xml.sax.saxutils import escape

# --- palette -----------------------------------------------------------------
# Sampled from the ink of the original artwork, one value per role.
NAVY_DEEP = '#001120'
NAVY = '#04182b'
NAVY_INK = '#081528'
GOLD = '#dda54a'
GOLD_SCRIPT = '#eebd3f'   # the gold the handwritten lines are set in
GOLD_PALE = '#ecc67f'     # ad 2's headline and ad 4's script
GOLD_HEAD = '#c48c2f'     # ad 1's second headline line
GOLD_DEEP = '#b8943f'     # the site accent
GOLD_LIGHT = '#f2d79a'
GOLD_DARK = '#a8762c'
CREAM = '#f0e8de'
MIST = '#eef2f6'
WHITE = '#ffffff'

# --- type --------------------------------------------------------------------
# Substitutes for the fonts in the original collage; see marketing/ads/README.md.
# The display face is Archivo with its width axis at 90, which matches the
# letterform widths measured in the artwork. Set SANS = 'Montserrat' for the
# site's brand font instead; sizes below are tuned for Archivo SemiCondensed.
SANS = 'Archivo SemiCondensed'
SERIF = 'CormorantGaramond'
SCRIPT_BRUSH = 'Kaushan Script'
SCRIPT_MONO = 'DancingScript'

W_REGULAR, W_MEDIUM, W_SEMIBOLD, W_BOLD, W_EXTRABOLD = 400, 500, 600, 700, 800


def _attrs(pairs: dict) -> str:
    out = []
    for key, value in pairs.items():
        if value is None:
            continue
        out.append(f'{key.replace("_", "-")}="{value}"')
    return ' '.join(out)


def group(name: str, *children: str, **attrs) -> str:
    """A named group. Illustrator and Photoshop both surface `id` as the layer name."""
    body = '\n'.join(c for c in children if c)
    head = _attrs({'id': name, **attrs})
    return f'<g {head}>\n{body}\n</g>'


def text(
    value: str,
    x: float,
    y: float,
    size: float,
    *,
    family: str = SANS,
    weight: int | None = None,
    fill: str = NAVY_INK,
    anchor: str | None = None,
    tracking: float | None = None,
    opacity: float | None = None,
    rotate: float | None = None,
    style: str | None = None,
) -> str:
    """One line of live, editable text."""
    attrs = _attrs(
        {
            'x': round(x, 2),
            'y': round(y, 2),
            'font-family': family,
            'font-size': size,
            'font-weight': weight,
            'font-style': style,
            'fill': fill,
            'text-anchor': anchor,
            'letter-spacing': tracking,
            'opacity': opacity,
        }
    )
    node = f'<text {attrs}>{escape(value)}</text>'
    if rotate:
        return f'<g transform="rotate({rotate} {round(x, 2)} {round(y, 2)})">{node}</g>'
    return node


def rect(x, y, w, h, fill, *, radius=0, opacity=None, stroke=None, stroke_width=None) -> str:
    return (
        '<rect '
        + _attrs(
            {
                'x': round(x, 2),
                'y': round(y, 2),
                'width': round(w, 2),
                'height': round(h, 2),
                'rx': radius or None,
                'fill': fill,
                'opacity': opacity,
                'stroke': stroke,
                'stroke-width': stroke_width,
            }
        )
        + '/>'
    )


def circle(cx, cy, r, fill=None, *, stroke=None, stroke_width=None, opacity=None) -> str:
    return (
        '<circle '
        + _attrs(
            {
                'cx': round(cx, 2),
                'cy': round(cy, 2),
                'r': round(r, 2),
                'fill': fill or 'none',
                'stroke': stroke,
                'stroke-width': stroke_width,
                'opacity': opacity,
            }
        )
        + '/>'
    )


def path(d: str, *, fill='none', stroke=None, stroke_width=None, opacity=None, cap='round') -> str:
    return (
        '<path '
        + _attrs(
            {
                'd': d,
                'fill': fill,
                'stroke': stroke,
                'stroke-width': stroke_width,
                'stroke-linecap': cap if stroke else None,
                'stroke-linejoin': cap if stroke else None,
                'opacity': opacity,
            }
        )
        + '/>'
    )


def line(x1, y1, x2, y2, stroke, width=1, *, opacity=None) -> str:
    return path(f'M{round(x1, 2)} {round(y1, 2)}L{round(x2, 2)} {round(y2, 2)}',
                stroke=stroke, stroke_width=width, opacity=opacity)


def linear_gradient(gid: str, stops: list[tuple[float, str, float | None]], *, x1=0, y1=0, x2=0, y2=1) -> str:
    body = ''.join(
        f'<stop offset="{off}" stop-color="{color}"'
        + (f' stop-opacity="{op}"' if op is not None else '')
        + '/>'
        for off, color, op in stops
    )
    return (
        f'<linearGradient id="{gid}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{body}</linearGradient>'
    )


GOLD_SHEEN = [(0, GOLD_LIGHT, None), (0.45, GOLD, None), (1, GOLD_DARK, None)]


# --- icons -------------------------------------------------------------------
# Monoline glyphs drawn on a 24x24 grid so one scale factor fits every use.
ICONS: dict[str, list[str]] = {
    'doc_check': [
        'M7 3.2h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.2a2 2 0 0 1 2-2z',
        'M14 3.2v4h4',
        'M8.2 10.6h6.6M8.2 13.4h6.6M8.2 16.2h3.6',
    ],
    'chart_up': [
        'M5 19.4h14',
        'M7.4 19.4v-4.2M11.6 19.4v-6.4M15.8 19.4v-9',
        'M6 12.4l4-3.8 3 2.6 4.6-5',
        'M14.6 6.2h3.6v3.6',
    ],
    'dollar': [
        'M12 3.6v16.8',
        'M15.8 8.4c0-1.9-1.7-2.9-3.8-2.9s-3.8 1-3.8 2.8c0 2 2.1 2.5 3.8 3 1.8.5 4 1 4 3.2 0 2-1.9 3-4 3s-4-1-4-3',
    ],
    'shield': ['M12 3.2l7.2 3v6.1c0 4.3-3 7.8-7.2 9.2-4.2-1.4-7.2-4.9-7.2-9.2V6.2z'],
    'shield_check': [
        'M12 3.2l7.2 3v6.1c0 4.3-3 7.8-7.2 9.2-4.2-1.4-7.2-4.9-7.2-9.2V6.2z',
        'M8.6 12.2l2.6 2.6 4.2-4.8',
    ],
    'lock': [
        'M6.4 10.6h11.2a1.4 1.4 0 0 1 1.4 1.4v7a1.4 1.4 0 0 1-1.4 1.4H6.4A1.4 1.4 0 0 1 5 19v-7a1.4 1.4 0 0 1 1.4-1.4z',
        'M8.6 10.6V8a3.4 3.4 0 0 1 6.8 0v2.6',
        'M12 14.2v3',
    ],
    'people': [
        'M9.2 11.4a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2z',
        'M3.4 19.6c0-3.2 2.6-5.4 5.8-5.4s5.8 2.2 5.8 5.4',
        'M16 11.8a2.6 2.6 0 1 0 0-5.2',
        'M17 14.6c2.1.5 3.6 2.3 3.6 4.6',
    ],
    'house': [
        'M4 11.6L12 5.2l8 6.4',
        'M6.6 10.4V19.6h10.8V10.4',
        'M10.2 19.6v-5h3.6v5',
        'M15.6 7.4V5.2h2v3.8',
    ],
    'car': [
        'M5.4 14.2l1.7-4.3a2.1 2.1 0 0 1 2-1.3h5.8a2.1 2.1 0 0 1 2 1.3l1.7 4.3',
        'M4.6 14.2h14.8a1.2 1.2 0 0 1 1.2 1.2v2.2a1.2 1.2 0 0 1-1.2 1.2H4.6a1.2 1.2 0 0 1-1.2-1.2v-2.2a1.2 1.2 0 0 1 1.2-1.2z',
        'M7 16.6h1.6M15.4 16.6H17',
    ],
    'cap': [
        'M2.8 9.6L12 5.4l9.2 4.2-9.2 4.2z',
        'M6.8 11.6v4.2c0 1.5 2.3 2.7 5.2 2.7s5.2-1.2 5.2-2.7v-4.2',
        'M19.4 10.6v4.6',
    ],
    'bolt': ['M13.4 3.4L6.2 13.8h4.6L10 20.6l7.4-10.8h-4.6z'],
    'wrench': [
        'M14.8 3.6a4.2 4.2 0 0 0-3.5 6.4L4 17.3l2.7 2.7 7.3-7.3a4.2 4.2 0 0 0 5.2-5.9l-2.6 2.6-2.2-2.2z',
    ],
    'key': [
        'M9 15a4.2 4.2 0 1 0 0-8.4A4.2 4.2 0 0 0 9 15z',
        'M12.6 12.4L20 19.8',
        'M17.2 17l-2 2M19 18.8l-1.4 1.4',
    ],
    'check': ['M5 12.6l4.6 4.6L19 6.8'],
    'chevron': ['M9.6 5.6L16 12l-6.4 6.4'],
}


def icon(name: str, cx: float, cy: float, size: float, color: str, stroke_width: float = 1.6) -> str:
    """Place a 24-grid monoline icon centred on (cx, cy) at `size` units tall."""
    k = size / 24.0
    body = ''.join(
        path(d, stroke=color, stroke_width=round(stroke_width / k, 2)) for d in ICONS[name]
    )
    tx = round(cx - size / 2, 2)
    ty = round(cy - size / 2, 2)
    return f'<g transform="translate({tx} {ty}) scale({round(k, 4)})">{body}</g>'


# --- composed elements -------------------------------------------------------
# Proportions of the sunrise mark, measured off the largest copy of it in the
# artwork (ad 1) and confirmed against the other four. Everything is a multiple of
# the arc's outer horizontal radius, so one number sizes the whole mark.
MARK_HEIGHT = 0.78       # vertical radius
MARK_THICKNESS = 0.16    # width of the arc band
MARK_RULE = 1.83         # half length of the rule along the base
MARK_STROKE = 0.078      # ray and rule weight
MARK_RAYS = 13
MARK_SPREAD = 80.0       # degrees each side of vertical
MARK_INNER = 1.15        # where the rays start, in vertical radii
MARK_OUTER = 2.0         # where the middle ray ends
MARK_FALLOFF = 0.30      # how much shorter the rays get towards the horizon


def sun_mark(cx: float, base_y: float, rx: float, *, fill: str, ray_color: str) -> str:
    """The sunrise mark: a flattened half ring over a rule, with a fan of rays.

    The rays sit on the same ellipse as the arc and shorten towards the horizon,
    following the tip positions measured off the artwork.
    """
    ry = rx * MARK_HEIGHT
    thickness = rx * MARK_THICKNESS
    inner_rx = rx - thickness
    inner_ry = ry - thickness * MARK_HEIGHT
    arc = (
        f'M{round(cx - rx, 2)} {round(base_y, 2)}'
        f'a{round(rx, 2)} {round(ry, 2)} 0 0 1 {round(rx * 2, 2)} 0'
        f'h{round(-thickness, 2)}'
        f'a{round(inner_rx, 2)} {round(inner_ry, 2)} 0 0 0 {round(-inner_rx * 2, 2)} 0'
        'z'
    )

    stroke_w = max(rx * MARK_STROKE, 0.6)
    middle = (MARK_RAYS - 1) / 2
    spokes = []
    for i in range(MARK_RAYS):
        step = (i - middle) / middle
        tilt = math.radians(step * MARK_SPREAD)
        reach = MARK_OUTER * (1 - MARK_FALLOFF * step**2)
        u, v = math.sin(tilt), math.cos(tilt)
        spokes.append(
            line(
                cx + rx * u * MARK_INNER,
                base_y - ry * v * MARK_INNER,
                cx + rx * u * reach,
                base_y - ry * v * reach,
                ray_color,
                stroke_w,
            )
        )

    rule = line(cx - rx * MARK_RULE, base_y, cx + rx * MARK_RULE, base_y, ray_color, stroke_w)
    return group('Sun mark', path(arc, fill=fill), *spokes, rule)


def logo(
    cx: float,
    mark_base_y: float,
    *,
    mark_cx: float,
    mark_rx: float,
    mark_fill: str,
    mark_rays: str,
    wordmark_baseline: float,
    wordmark_size: float,
    wordmark_tracking: float,
    word_color: str,
    tagline_baseline: float,
    tagline_size: float,
    tagline_tracking: float,
    tagline_color: str,
    wordmark: str = 'SUNDAY HARMONY',
    tagline: str = 'BUILDING A BRIGHTER TOMORROW',
    layer_name: str = 'Logo',
) -> str:
    return group(
        layer_name,
        sun_mark(mark_cx, mark_base_y, mark_rx, fill=mark_fill, ray_color=mark_rays),
        text(
            wordmark,
            cx,
            wordmark_baseline,
            wordmark_size,
            family=SERIF,
            weight=W_MEDIUM,
            fill=word_color,
            anchor='middle',
            tracking=wordmark_tracking,
        ),
        text(
            tagline,
            cx,
            tagline_baseline,
            tagline_size,
            weight=W_MEDIUM,
            fill=tagline_color,
            anchor='middle',
            tracking=tagline_tracking,
        ),
    )


def pill_button(
    x: float,
    y: float,
    w: float,
    h: float,
    label: str,
    *,
    fill: str,
    label_color: str,
    label_size: float,
    label_weight: int = W_BOLD,
    label_cx: float | None = None,
    label_baseline: float | None = None,
    chevron_color: str | None = None,
    chevron_bg: str | None = None,
    chevron_cx: float | None = None,
    chevron_size: float | None = None,
    tracking: float | None = None,
    radius: float | None = None,
    layer_name: str = 'CTA',
) -> str:
    """Rounded CTA pill with an optional chevron on the right.

    The label and chevron default to a centred layout; every ad passes the position
    measured from the artwork instead, so the button matches the original.
    """
    parts = [rect(x, y, w, h, fill, radius=h / 2 if radius is None else radius)]
    parts.append(
        text(
            label,
            label_cx if label_cx is not None else x + w * 0.42,
            label_baseline if label_baseline is not None else y + h / 2 + label_size * 0.35,
            label_size,
            weight=label_weight,
            fill=label_color,
            anchor='middle',
            tracking=tracking,
        )
    )
    if chevron_color:
        ccx = chevron_cx if chevron_cx is not None else x + w - h * 0.62
        ccy = y + h / 2
        if chevron_bg:
            parts.append(circle(ccx, ccy, h * 0.28, chevron_bg))
        parts.append(
            icon('chevron', ccx, ccy, chevron_size or h * 0.30, chevron_color, stroke_width=2.2)
        )
    return group(layer_name, *parts)


def icon_badge(
    cx: float,
    cy: float,
    r: float,
    icon_name: str,
    *,
    disc: str = NAVY,
    accent: str = GOLD,
    glyph: str = WHITE,
    crescent: bool = True,
) -> str:
    """Navy disc with a gold crescent peeking out behind it, as used in ad 1 and 5."""
    parts = []
    if crescent:
        parts.append(circle(cx - r * 0.13, cy - r * 0.13, r, accent))
    parts.append(circle(cx, cy, r, disc))
    parts.append(icon(icon_name, cx, cy, r * 1.15, glyph, stroke_width=1.5))
    return group(f'Badge {icon_name}', *parts)


def check_badge(cx: float, cy: float, r: float, *, disc: str = GOLD, glyph: str = WHITE) -> str:
    return group(
        'Check badge',
        circle(cx, cy, r, disc),
        icon('check', cx, cy, r * 1.15, glyph, stroke_width=2.4),
    )


def smooth_wave(points: list[tuple[float, float]]) -> str:
    """Catmull-Rom through `points` as cubic Beziers: few anchors, easy to reshape."""
    if len(points) < 2:
        raise ValueError('a wave needs at least two points')
    d = [f'M{round(points[0][0], 2)} {round(points[0][1], 2)}']
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i > 0 else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(
            f'C{round(c1[0], 2)} {round(c1[1], 2)} {round(c2[0], 2)} {round(c2[1], 2)}'
            f' {round(p2[0], 2)} {round(p2[1], 2)}'
        )
    return ' '.join(d)


def wave_band(
    points: list[tuple[float, float]],
    width: float,
    height: float,
    *,
    fill: str,
    edge: str | None = None,
    edge_width: float = 2.0,
    layer_name: str = 'Wave band',
) -> str:
    """Filled band from a wave down to the bottom edge, with an optional bright rim."""
    curve = smooth_wave(points)
    closed = f'{curve} L{round(width, 2)} {round(height, 2)} L0 {round(height, 2)} Z'
    parts = [path(closed, fill=fill)]
    if edge:
        parts.append(path(curve, stroke=edge, stroke_width=edge_width))
    return group(layer_name, *parts)


def divider(x: float, y1: float, y2: float, color: str, *, opacity=0.45, width=1.0) -> str:
    return line(x, y1, x, y2, color, width, opacity=opacity)


@dataclass
class Layer:
    """One named layer: an SVG group in the AI file, a pixel layer in the PSD."""

    name: str
    body: str

    def svg(self) -> str:
        return group(self.name, self.body)


@dataclass
class Ad:
    slug: str
    title: str
    width: int
    height: int
    layers: list[Layer] = field(default_factory=list)
    defs: list[str] = field(default_factory=list)
    scale: float = 2.0

    def add(self, name: str, *body: str) -> None:
        self.layers.append(Layer(name, '\n'.join(b for b in body if b)))

    def svg(self, *, only: str | None = None) -> str:
        chosen = [l for l in self.layers if only is None or l.name == only]
        defs = f'<defs>{"".join(self.defs)}</defs>' if self.defs else ''
        body = '\n'.join(l.svg() for l in chosen)
        out_w = round(self.width * self.scale)
        out_h = round(self.height * self.scale)
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n'
            f'     width="{out_w}" height="{out_h}" viewBox="0 0 {self.width} {self.height}">\n'
            f'  <title>{escape(self.title)}</title>\n'
            f'  {defs}\n{body}\n</svg>\n'
        )
