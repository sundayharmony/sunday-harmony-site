"""Layout for the five Sunday Harmony ads.

Coordinates are in each ad's artboard grid, which is the pixel grid of its cell in
the original collage. Type position and size come from `metrics.py`, which
`calibrate.py` solves by measuring the ink of every text run in the artwork; this
file holds the structure, colour and the vector furniture around that type.
"""

from __future__ import annotations

import base64
from pathlib import Path

from brand import (
    CREAM,
    GOLD,
    GOLD_DARK,
    GOLD_DEEP,
    GOLD_HEAD,
    GOLD_LIGHT,
    GOLD_PALE,
    GOLD_SCRIPT,
    GOLD_SHEEN,
    NAVY_DEEP,
    NAVY_INK,
    SANS,
    SCRIPT_BRUSH,
    SCRIPT_MONO,
    SERIF,
    W_BOLD,
    W_MEDIUM,
    W_SEMIBOLD,
    WHITE,
    Ad,
    check_badge,
    divider,
    icon,
    icon_badge,
    line,
    linear_gradient,
    logo,
    pill_button,
    rect,
    text,
    wave_band,
)
from metrics import METRICS

ASSETS = Path(__file__).resolve().parent.parent / 'assets'

BODY_INK = '#33465c'
BODY_ON_DARK = '#e8edf3'
TAGLINE_DARK = '#5b6b7d'
TAGLINE_LIGHT = '#cfd8e3'

FAMILIES = {'sans': SANS, 'serif': SERIF, 'brush': SCRIPT_BRUSH, 'mono_script': SCRIPT_MONO}


def t(key: str, fill: str, *, anchor: str | None = None,
      dx: float = 0.0, dy: float = 0.0, size: float | None = None) -> str:
    """Draw a measured run: position, size, tracking and tilt come from the artwork."""
    m = METRICS[key]
    scale = 1.0 if size is None else size / m['size']
    rotate = m.get('rotate') or None
    if rotate:
        # A tilted run is fitted around the centre of its ink, so it has to turn
        # about that centre too.
        anchor = 'middle'
    return text(
        m['text'],
        (m['cx'] if anchor == 'middle' else m['x']) + dx,
        m['baseline'] + dy,
        size or m['size'],
        family=FAMILIES[m['family']],
        weight=m['weight'] if m['family'] != 'brush' else None,
        fill=fill,
        anchor=anchor,
        tracking=(m['tracking'] * scale) or None,
        rotate=rotate,
    )


def lockup(
    slug: str,
    *,
    mark_cx: float,
    mark_base_y: float,
    mark_rx: float,
    mark_rays: str,
    word_color: str,
    tagline_color: str,
) -> str:
    """The Sunday Harmony lockup: measured mark, measured wordmark and tagline."""
    word = METRICS[f'{slug}.wordmark']
    tag = METRICS[f'{slug}.tagline']
    return logo(
        word['cx'],
        mark_base_y,
        mark_cx=mark_cx,
        mark_rx=mark_rx,
        mark_fill='url(#goldArc)',
        mark_rays=mark_rays,
        wordmark_baseline=word['baseline'],
        wordmark_size=word['size'],
        wordmark_tracking=word['tracking'],
        word_color=word_color,
        tagline_baseline=tag['baseline'],
        tagline_size=tag['size'],
        tagline_tracking=tag['tracking'],
        tagline_color=tagline_color,
    )


def cta(
    key: str,
    x: float,
    y: float,
    w: float,
    h: float,
    *,
    fill: str,
    label_color: str,
    chevron_cx: float,
    chevron_size: float,
    label_weight: int = W_BOLD,
    radius: float | None = None,
) -> str:
    """A CTA button: pill geometry from the artwork, label position from the metrics."""
    m = METRICS[key]
    return pill_button(
        x,
        y,
        w,
        h,
        m['text'],
        fill=fill,
        label_color=label_color,
        label_size=m['size'],
        label_weight=label_weight,
        label_cx=m['cx'],
        label_baseline=m['baseline'],
        chevron_color=label_color,
        chevron_cx=chevron_cx,
        chevron_size=chevron_size,
        radius=radius,
    )


def photo(slug: str, width: float, height: float) -> str:
    """Embed the cleaned photographic plate so the file travels on its own."""
    data = base64.b64encode((ASSETS / f'{slug}-photo.jpg').read_bytes()).decode()
    return (
        f'<image x="0" y="0" width="{width}" height="{height}" '
        f'preserveAspectRatio="none" xlink:href="data:image/jpeg;base64,{data}"/>'
    )


def gold_defs() -> list[str]:
    return [
        linear_gradient('goldArc', GOLD_SHEEN),
        linear_gradient('goldPill', [(0, '#eab758', None), (1, '#dfa640', None)]),
        linear_gradient('goldRim', [(0, GOLD_LIGHT, None), (1, GOLD_DEEP, None)], x1=0, y1=0, x2=1, y2=0),
        linear_gradient('goldBand', [(0, '#eec275', None), (0.5, '#e2ad50', None), (1, '#dda646', None)]),
    ]


# --- ad 1: credit repair & funding solutions ---------------------------------
def ad1() -> Ad:
    ad = Ad('01-credit-repair-funding-solutions', 'Credit Repair & Funding Solutions', 815, 686)
    ad.defs = gold_defs()

    ad.add('Photo', photo('ad1', 815, 686))

    ad.add(
        'Logo',
        lockup('ad1', mark_cx=167.5, mark_base_y=80, mark_rx=39.5,
               mark_rays=GOLD_DEEP, word_color=NAVY_INK, tagline_color=NAVY_INK),
    )

    ad.add('Headline', t('ad1.head1', NAVY_INK), t('ad1.head2', GOLD_HEAD))
    ad.add('Subhead', t('ad1.sub1', NAVY_INK), t('ad1.sub2', NAVY_INK))

    features = [
        ('doc_check', 350, 'ad1.f1t', 'ad1.f1s'),
        ('chart_up', 414, 'ad1.f2t', 'ad1.f2s'),
        ('dollar', 479, 'ad1.f3t', 'ad1.f3s'),
        ('shield_check', 547, 'ad1.f4t', 'ad1.f4s'),
    ]
    rows = []
    for glyph, cy, title_key, sub_key in features:
        rows.append(icon_badge(59, cy, 22, glyph))
        rows.append(t(title_key, NAVY_INK))
        rows.append(t(sub_key, BODY_INK))
    ad.add('Feature rows', *rows)

    # Drawn a touch above the original rim so no trace of the flattened edge shows.
    ad.add(
        'Wave band',
        wave_band(
            [(0, 600), (140, 590), (300, 587), (460, 589), (600, 582), (700, 562), (815, 543)],
            815,
            686,
            fill=NAVY_DEEP,
            edge='url(#goldRim)',
            edge_width=2.6,
        ),
    )

    ad.add(
        'Script',
        t('ad1.script1', GOLD_SCRIPT),
        t('ad1.script2', GOLD_SCRIPT),
    )

    ad.add(
        'CTA',
        cta('ad1.cta', 37, 607, 255, 46, fill='url(#goldPill)', label_color=NAVY_DEEP,
            chevron_cx=264, chevron_size=15),
    )

    trust = []
    for glyph, key in [('shield', 'ad1.trust1'), ('lock', 'ad1.trust2'), ('people', 'ad1.trust3')]:
        trust.append(icon(glyph, METRICS[key]['cx'], 622, 23, WHITE, stroke_width=1.4))
        trust.append(t(key, WHITE, anchor='middle'))
    ad.add('Trust row', *trust)

    return ad


# --- ad 2: fix your credit, unlock your future -------------------------------
def ad2() -> Ad:
    ad = Ad('02-fix-your-credit-unlock-your-future', 'Fix Your Credit. Unlock Your Future.', 421, 686)
    ad.defs = gold_defs()

    ad.add('Photo', photo('ad2', 421, 686))

    ad.add(
        'Logo',
        lockup('ad2', mark_cx=208.5, mark_base_y=76, mark_rx=29.5,
               mark_rays=GOLD, word_color=WHITE, tagline_color=TAGLINE_LIGHT),
    )

    nav_baseline = METRICS['ad2.nav1']['baseline']
    ad.add(
        'Nav row',
        t('ad2.nav1', GOLD),
        t('ad2.nav2', WHITE),
        text('|', 166, nav_baseline, 12.5, weight=W_MEDIUM, fill=WHITE, opacity=0.5),
        t('ad2.nav3', WHITE),
        text('|', 262, nav_baseline, 12.5, weight=W_MEDIUM, fill=WHITE, opacity=0.5),
        t('ad2.nav4', WHITE),
        line(34, 147, 137, 147, GOLD, 1.2),
        line(325, 147, 396, 147, WHITE, 1.0, opacity=0.6),
    )

    ad.add(
        'Headline',
        t('ad2.head1', WHITE),
        t('ad2.head2', GOLD_PALE),
        t('ad2.head3', GOLD_PALE),
    )

    ad.add('Body copy', t('ad2.body1', BODY_ON_DARK), t('ad2.body2', BODY_ON_DARK),
           t('ad2.body3', BODY_ON_DARK))

    checklist = []
    for key in ['ad2.list1', 'ad2.list2', 'ad2.list3', 'ad2.list4']:
        checklist.append(check_badge(45, METRICS[key]['baseline'] - 5.8, 11.5))
        checklist.append(t(key, WHITE))
    ad.add('Checklist', *checklist)

    ad.add(
        'CTA',
        cta('ad2.cta', 34, 551, 191, 44, fill='url(#goldPill)', label_color=NAVY_DEEP,
            chevron_cx=196, chevron_size=15),
    )

    return ad


# --- ad 3: real solutions for your financial goals ---------------------------
def ad3() -> Ad:
    ad = Ad('03-real-solutions-for-your-financial-goals', 'Real Solutions for Your Financial Goals',
            425, 533)
    ad.defs = gold_defs()

    ad.add('Photo', photo('ad3', 425, 440))
    ad.add('Trust band', rect(0, 432, 425, 101, CREAM))

    ad.add(
        'Logo',
        lockup('ad3', mark_cx=208.5, mark_base_y=48, mark_rx=24.5,
               mark_rays=GOLD_DEEP, word_color=NAVY_INK, tagline_color=TAGLINE_DARK),
    )

    ad.add(
        'Headline',
        t('ad3.eyebrow', NAVY_INK),
        t('ad3.script', NAVY_INK),
        t('ad3.sub', NAVY_INK),
    )

    checklist = []
    for key in ['ad3.list1', 'ad3.list2', 'ad3.list3', 'ad3.list4', 'ad3.list5']:
        baseline = METRICS[key]['baseline']
        checklist.append(icon('check', 62, baseline - 5, 15, NAVY_INK, stroke_width=2.0))
        checklist.append(t(key, NAVY_INK))
    ad.add('Checklist', *checklist)

    ad.add(
        'CTA',
        cta('ad3.cta', 36, 376, 233, 39, fill=NAVY_INK, label_color=WHITE,
            chevron_cx=242, chevron_size=13, label_weight=W_SEMIBOLD, radius=8),
    )

    badges = []
    for glyph, cx, keys in [
        ('bolt', 78, ('ad3.trust1a', 'ad3.trust1b')),
        ('shield', 207.5, ('ad3.trust2a', 'ad3.trust2b')),
        ('people', 348, ('ad3.trust3a', 'ad3.trust3b')),
    ]:
        badges.append(icon(glyph, cx, 468, 24, NAVY_INK, stroke_width=1.5))
        badges.extend(t(key, NAVY_INK, anchor='middle') for key in keys)
    badges.append(divider(141, 459, 513, NAVY_INK, opacity=0.2))
    badges.append(divider(275, 459, 513, NAVY_INK, opacity=0.2))
    ad.add('Trust badges', *badges)

    return ad


# --- ad 4: stronger credit today --------------------------------------------
def ad4() -> Ad:
    ad = Ad('04-stronger-credit-today', 'Stronger Credit Today. More Possibilities Tomorrow.',
            381, 533)
    ad.defs = gold_defs()

    ad.add('Photo', photo('ad4', 381, 533))

    ad.add(
        'Logo',
        lockup('ad4', mark_cx=184.5, mark_base_y=59, mark_rx=24.5,
               mark_rays=GOLD, word_color=WHITE, tagline_color=TAGLINE_LIGHT),
    )

    nav_baseline = METRICS['ad4.nav1']['baseline']
    ad.add(
        'Nav row',
        t('ad4.nav1', WHITE),
        text('+', 212.5, nav_baseline, 12.7, weight=W_MEDIUM, fill=WHITE, anchor='middle'),
        t('ad4.nav2', WHITE),
        line(78, 136, 190, 136, WHITE, 0.9, opacity=0.55),
        line(235, 136, 313, 136, WHITE, 0.9, opacity=0.55),
    )

    ad.add('Headline', t('ad4.head1', WHITE, anchor='middle'), t('ad4.head2', WHITE, anchor='middle'))

    ad.add(
        'Script',
        t('ad4.script1', GOLD_PALE),
        t('ad4.script2', GOLD_PALE),
    )

    benefits = []
    quartet = [
        ('house', ['ad4.icon1']),
        ('car', ['ad4.icon2']),
        ('chart_up', ['ad4.icon3']),
        ('cap', ['ad4.icon4']),
    ]
    extra_lines = {'ad4.icon3': 'Business', 'ad4.icon4': 'Your Future'}
    for glyph, keys in quartet:
        cx = METRICS[keys[0]]['cx']
        benefits.append(icon(glyph, cx, 352, 31, WHITE, stroke_width=1.3))
        for key in keys:
            benefits.append(t(key, WHITE, anchor='middle'))
            second = extra_lines.get(key)
            if second:
                m = METRICS[key]
                benefits.append(
                    text(second, m['cx'], m['baseline'] + 15, m['size'], fill=WHITE,
                         anchor='middle')
                )
    for x in (102, 189, 278):
        benefits.append(divider(x, 336, 404, WHITE, opacity=0.3))
    ad.add('Benefit row', *benefits)

    ad.add(
        'CTA',
        cta('ad4.cta', 80, 444, 221, 46, fill='url(#goldPill)', label_color=NAVY_DEEP,
            chevron_cx=272.5, chevron_size=15),
    )

    return ad


# --- ad 5: credit repair & funding, it's possible ----------------------------
def ad5() -> Ad:
    ad = Ad('05-credit-repair-funding-its-possible', "Credit Repair & Funding - It's Possible.",
            418, 533)
    ad.defs = gold_defs()

    ad.add('Photo', photo('ad5', 418, 460))

    ad.add(
        'Gold band',
        wave_band(
            [(0, 436), (120, 439), (200, 430), (280, 416), (360, 398), (418, 391)],
            418,
            533,
            fill='url(#goldBand)',
            layer_name='Band shape',
        ),
    )

    ad.add(
        'Logo',
        lockup('ad5', mark_cx=100, mark_base_y=42, mark_rx=22,
               mark_rays=GOLD_DEEP, word_color=NAVY_INK, tagline_color=TAGLINE_DARK),
    )

    ad.add(
        'Script headline',
        t('ad5.script1', NAVY_INK),
        t('ad5.script2', NAVY_INK),
        t('ad5.script3', NAVY_INK),
        t('ad5.kicker', NAVY_INK),
    )

    badges = []
    for glyph, key in [('wrench', 'ad5.list1'), ('dollar', 'ad5.list2'),
                       ('chart_up', 'ad5.list3'), ('key', 'ad5.list4')]:
        badges.append(icon_badge(40, METRICS[key]['baseline'] - 6.6, 12.3, glyph, crescent=False))
        badges.append(t(key, NAVY_INK))
    ad.add('Benefit badges', *badges)

    ad.add(
        'CTA',
        cta('ad5.cta', 27, 454, 195, 46, fill=NAVY_INK, label_color=WHITE,
            chevron_cx=184.5, chevron_size=13),
    )

    ad.add(
        'Script accent',
        t('ad5.script4', NAVY_INK),
        t('ad5.script5', NAVY_INK),
    )

    return ad


ALL_ADS = [ad1, ad2, ad3, ad4, ad5]
