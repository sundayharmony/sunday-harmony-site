"""Measure the type in the original collage and solve for size, tracking and position.

Run this to regenerate `metrics.py`, which `specs.py` reads:

    python3 calibrate.py

For each run it finds the ink bounds of that text in the flattened artwork, then
solves the substitute font back onto the same box. Display faces are fitted by
width, because the fonts in the original are narrower than the free substitutes
and matching the width is what preserves the layout. Runs that are genuinely
letterspaced in the artwork are fitted by height with tracking solved to fill the
measured width.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BUILD = Path(__file__).resolve().parent
ADS = BUILD.parent
FONT_DIR = ADS / 'fonts'

FONTS = {
    ('sans', 400): 'ArchivoSemiCondensed-Regular.ttf',
    ('sans', 500): 'ArchivoSemiCondensed-Medium.ttf',
    ('sans', 600): 'ArchivoSemiCondensed-SemiBold.ttf',
    ('sans', 700): 'ArchivoSemiCondensed-Bold.ttf',
    ('sans', 800): 'ArchivoSemiCondensed-ExtraBold.ttf',
    ('serif', 500): 'CormorantGaramond-Medium.ttf',
    ('brush', 400): 'KaushanScript-Regular.ttf',
    ('mono_script', 700): 'DancingScript-Bold.ttf',
}


def _crops() -> dict[str, np.ndarray]:
    from photos import CELLS, SOURCE

    collage = Image.open(SOURCE).convert('L')
    return {slug: np.asarray(collage.crop(box)).astype(int) for slug, box in CELLS.items()}


CROPS = _crops()


def ink_box(slug: str, region, mode: str, threshold: int):
    x0, y0, x1, y1 = region
    sub = CROPS[slug][y0:y1, x0:x1]
    hit = sub < threshold if mode == 'dark' else sub > threshold
    if not hit.any():
        return None
    ys, xs = np.where(hit)
    return dict(
        left=x0 + int(xs.min()), top=y0 + int(ys.min()),
        right=x0 + int(xs.max()), bottom=y0 + int(ys.max()),
        w=int(xs.max() - xs.min() + 1), h=int(ys.max() - ys.min() + 1),
    )


def ink_metrics(font_file: str, value: str, size: int):
    """Ink size, left bearing and height above baseline for `value` at `size`."""
    font = ImageFont.truetype(str(FONT_DIR / font_file), size)
    canvas = Image.new('L', (4000, 700), 255)
    ImageDraw.Draw(canvas).text((200, 500), value, font=font, fill=0, anchor='ls')
    arr = np.asarray(canvas)
    ys, xs = np.where(arr < 160)
    return dict(
        w=int(xs.max() - xs.min() + 1),
        h=int(ys.max() - ys.min() + 1),
        lsb=int(xs.min()) - 200,
        above=500 - int(ys.min()),
        advance=font.getlength(value),
    )


def box_from(bounds: tuple[int, int, int, int]) -> dict:
    left, top, right, bottom = bounds
    return dict(left=left, top=top, right=right, bottom=bottom,
                w=right - left + 1, h=bottom - top + 1)


def solve(run: dict) -> dict | None:
    if run.get('box'):
        box = box_from(run['box'])
    else:
        box = ink_box(run['slug'], run['region'], run['mode'], run['threshold'])
    if not box:
        return None

    font_file = FONTS[(run['family'], run['weight'])]
    ref = 120
    ref_ink = ink_metrics(font_file, run['text'], ref)

    if run['fit'] == 'track':
        size = ref * box['h'] / ref_ink['h']
    else:
        # A tilted line's ink box is wider than the line itself, by the part of its
        # own height the tilt adds, so the fit has to allow for the angle.
        tilt = math.radians(abs(run['rotate']))
        spread = ref_ink['w'] * math.cos(tilt) + ref_ink['h'] * math.sin(tilt)
        size = ref * box['w'] / spread

    probe_size = max(int(round(size)), 6)
    ink = ink_metrics(font_file, run['text'], probe_size)
    k = size / probe_size

    tracking = 0.0
    if run['fit'] == 'track':
        spans = max(len(run['text']) - 1, 1)
        tracking = (box['w'] - ink['w'] * k) / spans

    if run['rotate'] or run['vcenter']:
        # A run drawn on a tilt has its highest ink at one end, so its box top is no
        # guide to the baseline. Centring the ink in the measured box is, because the
        # rotation in specs.py turns about that centre.
        centre = (box['top'] + box['bottom']) / 2
        baseline = centre + (ink['above'] - ink['h'] / 2) * k
    else:
        baseline = box['top'] + ink['above'] * k

    return dict(
        text=run['text'],
        family=run['family'],
        weight=run['weight'],
        x=round(box['left'] - ink['lsb'] * k, 1),
        cx=round((box['left'] + box['right']) / 2, 1),
        baseline=round(baseline, 1),
        size=round(size, 1),
        tracking=round(tracking, 2),
        rotate=run['rotate'],
        box=(box['w'], box['h']),
    )


def R(key, slug, text, family, weight, region, mode='dark', threshold=110, fit='width', group=None,
      box=None, vcenter=False, rotate=0.0):
    """One text run to measure. `group` shares one size across runs of the same style.

    Pass `box` as the run's ink bounds (left, top, right, bottom) to skip the
    threshold pass. Brush script overlaps its neighbours, so a few of those lines
    are read off the ruler in `ruler.py` instead of being found automatically.
    `rotate` is the angle the run is set at in the artwork, in degrees; it feeds
    both the fit here and the transform in specs.py.
    """
    return dict(key=key, slug=slug, text=text, family=family, weight=weight, region=region,
                mode=mode, threshold=threshold, fit=fit, group=group, box=box, vcenter=vcenter,
                rotate=rotate)


# Stacked display lines take the smallest fit in their group: the substitute faces
# are wider than the originals, so the median would let the longest line overrun.
SMALLEST_FIT = {'ad1.script', 'ad4.script', 'ad5.accent'}

# Rows that read as an evenly spaced list get one leading for the whole group.
EVEN_ROWS = {'ad1.ftitle', 'ad1.fsub', 'ad2.body', 'ad2.list', 'ad3.list', 'ad4.icon',
             'ad5.list'}

# Sizes that cannot be measured cleanly, because neighbouring photography or icons
# touch the ink. Set from the proof renders in marketing/ads/proofs.
SIZE_OVERRIDES = {'ad3.list': 15.0}


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def unify(solved: dict[str, dict], runs: list[dict]) -> None:
    """Share one size, tracking and leading across runs that share a style.

    Photography bordering a text run can inflate or clip its measured ink box.
    Styles that repeat in the design are meant to match anyway, so resolving them
    as a group is both more robust and truer to the original than trusting each
    row on its own.
    """
    groups: dict[str, list[str]] = {}
    for run in runs:
        if run['group'] and run['key'] in solved:
            groups.setdefault(run['group'], []).append(run['key'])

    for name, keys in groups.items():
        sizes = [solved[k]['size'] for k in keys]
        size = SIZE_OVERRIDES.get(name) or (min(sizes) if name in SMALLEST_FIT else _median(sizes))
        track = _median([solved[k]['tracking'] for k in keys])
        for key in keys:
            entry = solved[key]
            entry['size'] = round(size, 1)
            entry['tracking'] = round(track, 2)

        if name in EVEN_ROWS and len(keys) >= 3:
            ordered = sorted(keys, key=lambda k: solved[k]['baseline'])
            baselines = [solved[k]['baseline'] for k in ordered]
            gaps = [b - a for a, b in zip(baselines, baselines[1:])]
            # Stacked display lines drift when a taller substitute glyph sets the ink
            # top, so their leading comes from the tightest measured gap.
            gap = min(gaps) if name in SMALLEST_FIT else _median(gaps)
            for i, key in enumerate(ordered):
                solved[key]['baseline'] = round(baselines[0] + i * gap, 1)


RUNS = [
    # --- ad 1 -----------------------------------------------------------------
    R('ad1.wordmark', 'ad1', 'SUNDAY HARMONY', 'serif', 500, (48, 96, 312, 122), 'dark', 120, 'track'),
    R('ad1.tagline', 'ad1', 'BUILDING A BRIGHTER TOMORROW', 'sans', 500, (58, 122, 300, 138), 'dark', 150, 'track'),
    R('ad1.head1', 'ad1', 'CREDIT REPAIR &', 'sans', 800, (25, 156, 448, 200), 'dark', 110),
    R('ad1.head2', 'ad1', 'FUNDING SOLUTIONS', 'sans', 800, (25, 203, 445, 244), 'dark', 165),
    R('ad1.sub1', 'ad1', 'Better Credit. More Opportunities.', 'sans', 700, (25, 250, 400, 280), group='ad1.sub'),
    R('ad1.sub2', 'ad1', 'A Stronger You.', 'sans', 700, (25, 281, 220, 308), group='ad1.sub'),
    R('ad1.f1t', 'ad1', 'Remove Inaccuracies', 'sans', 700, (98, 328, 300, 348), group='ad1.ftitle'),
    R('ad1.f1s', 'ad1', 'Dispute errors and negative items', 'sans', 400, (98, 349, 320, 370), 'dark', 140, group='ad1.fsub'),
    R('ad1.f2t', 'ad1', 'Rebuild Your Credit', 'sans', 700, (98, 393, 300, 414), group='ad1.ftitle'),
    R('ad1.f2s', 'ad1', 'Improve your credit profile over time', 'sans', 400, (98, 415, 330, 436), 'dark', 140, group='ad1.fsub'),
    R('ad1.f3t', 'ad1', 'Business & Personal Funding', 'sans', 700, (98, 458, 320, 479), group='ad1.ftitle'),
    R('ad1.f3s', 'ad1', 'Get the capital you need to grow', 'sans', 400, (98, 480, 300, 501), 'dark', 140, group='ad1.fsub'),
    R('ad1.f4t', 'ad1', 'Credit Monitoring', 'sans', 700, (98, 527, 240, 548), group='ad1.ftitle'),
    R('ad1.f4s', 'ad1', 'Stay informed and protected', 'sans', 400, (98, 549, 300, 570), 'dark', 140, group='ad1.fsub'),
    R('ad1.cta', 'ad1', 'GET STARTED TODAY', 'sans', 700, None, box=(68, 623, 242, 635)),
    # The two script lines sit on the blazer at roughly -11 degrees; the solved size
    # is fitted to the rotated ink box, then nudged in specs.py.
    R('ad1.script1', 'ad1', 'Your Goals.', 'mono_script', 700, None, box=(555, 452, 703, 508),
      group='ad1.script', rotate=-11),
    R('ad1.script2', 'ad1', 'Our Mission.', 'mono_script', 700, None, box=(603, 490, 768, 547),
      group='ad1.script', rotate=-10),
    R('ad1.trust1', 'ad1', 'Secure', 'sans', 500, (505, 644, 566, 662), 'light', 170, group='ad1.trust'),
    R('ad1.trust2', 'ad1', 'Confidential', 'sans', 500, (588, 644, 676, 662), 'light', 170, group='ad1.trust'),
    R('ad1.trust3', 'ad1', 'Expert Support', 'sans', 500, (690, 644, 795, 662), 'light', 170, group='ad1.trust'),
    # --- ad 2 -----------------------------------------------------------------
    R('ad2.wordmark', 'ad2', 'SUNDAY HARMONY', 'serif', 500, (95, 86, 330, 110), 'light', 170, 'track'),
    R('ad2.tagline', 'ad2', 'BUILDING A BRIGHTER TOMORROW', 'sans', 500, (108, 110, 322, 126), 'light', 150, 'track'),
    R('ad2.nav1', 'ad2', 'CREDIT', 'sans', 600, (30, 132, 94, 146), 'light', 190, 'track', group='ad2.nav'),
    R('ad2.nav2', 'ad2', 'REPAIR', 'sans', 600, (95, 132, 158, 146), 'light', 190, 'track', group='ad2.nav'),
    R('ad2.nav3', 'ad2', 'FUNDING', 'sans', 600, (176, 132, 256, 146), 'light', 190, 'track', group='ad2.nav'),
    R('ad2.nav4', 'ad2', 'FINANCIAL FREEDOM', 'sans', 600, (276, 132, 400, 146), 'light', 190, 'track', group='ad2.nav'),
    R('ad2.head1', 'ad2', 'FIX YOUR CREDIT.', 'sans', 800, (28, 166, 408, 208), 'light', 210),
    R('ad2.head2', 'ad2', 'UNLOCK YOUR', 'sans', 800, (28, 210, 408, 252), 'light', 170),
    R('ad2.head3', 'ad2', 'FUTURE.', 'sans', 800, (28, 254, 408, 300), 'light', 170),
    R('ad2.body1', 'ad2', 'We help you remove errors, improve', 'sans', 400, (28, 315, 340, 336), 'light', 205, group='ad2.body'),
    R('ad2.body2', 'ad2', 'your credit profile and get the funding', 'sans', 400, (28, 337, 340, 359), 'light', 205, group='ad2.body'),
    R('ad2.body3', 'ad2', 'you need — fast.', 'sans', 400, (28, 360, 200, 378), 'light', 205, group='ad2.body'),
    R('ad2.list1', 'ad2', 'Credit Report Analysis', 'sans', 500, (62, 408, 300, 428), 'light', 205, group='ad2.list'),
    R('ad2.list2', 'ad2', 'Dispute Letter Support', 'sans', 500, (62, 439, 300, 460), 'light', 205, group='ad2.list'),
    R('ad2.list3', 'ad2', 'Personal & Business Funding', 'sans', 500, (62, 470, 300, 491), 'light', 205, group='ad2.list'),
    R('ad2.list4', 'ad2', 'Ongoing Credit Monitoring', 'sans', 500, (62, 502, 300, 526), 'light', 205, group='ad2.list'),
    R('ad2.cta', 'ad2', 'APPLY NOW', 'sans', 700, None, box=(65, 567, 173, 579)),
    # --- ad 3 -----------------------------------------------------------------
    R('ad3.wordmark', 'ad3', 'SUNDAY HARMONY', 'serif', 500, (98, 48, 332, 74), 'dark', 120, 'track'),
    R('ad3.tagline', 'ad3', 'BUILDING A BRIGHTER TOMORROW', 'sans', 500, (108, 74, 322, 90), 'dark', 150, 'track'),
    # The phone in the photograph is as dark as the type, so these three are boxed.
    R('ad3.eyebrow', 'ad3', 'CREDIT REPAIR & FUNDING', 'sans', 700, None, box=(36, 106, 290, 117),
      fit='track'),
    R('ad3.script', 'ad3', 'Real Solutions', 'brush', 400, None, box=(30, 129, 287, 187)),
    R('ad3.sub', 'ad3', 'for Your Financial Goals', 'sans', 700, None, box=(36, 188, 265, 209)),
    R('ad3.list1', 'ad3', 'Fix Credit Report Errors', 'sans', 500, (74, 232, 260, 250), group='ad3.list'),
    R('ad3.list2', 'ad3', 'Remove Negative Items', 'sans', 500, (74, 258, 260, 276), group='ad3.list'),
    R('ad3.list3', 'ad3', 'Build Stronger Credit', 'sans', 500, (74, 284, 260, 302), group='ad3.list'),
    R('ad3.list4', 'ad3', 'Access Funding Options', 'sans', 500, (74, 310, 260, 328), group='ad3.list'),
    R('ad3.list5', 'ad3', 'Get Expert Guidance', 'sans', 500, (74, 336, 260, 354), group='ad3.list'),
    R('ad3.cta', 'ad3', 'START YOUR APPLICATION', 'sans', 600, None, box=(66, 390, 225, 400)),
    R('ad3.trust1a', 'ad3', 'FASTER', 'sans', 700, None, box=(58, 491, 99, 500), fit='track',
      group='ad3.trust'),
    R('ad3.trust1b', 'ad3', 'APPROVALS', 'sans', 700, None, box=(45, 506, 112, 514), fit='track',
      group='ad3.trust'),
    R('ad3.trust2a', 'ad3', 'SECURE &', 'sans', 700, None, box=(181, 491, 235, 500), fit='track',
      group='ad3.trust'),
    R('ad3.trust2b', 'ad3', 'CONFIDENTIAL', 'sans', 700, None, box=(168, 506, 249, 514), fit='track',
      group='ad3.trust'),
    R('ad3.trust3a', 'ad3', 'PERSONALIZED', 'sans', 700, None, box=(306, 491, 391, 499), fit='track',
      group='ad3.trust'),
    R('ad3.trust3b', 'ad3', 'SUPPORT', 'sans', 700, None, box=(322, 506, 374, 514), fit='track',
      group='ad3.trust'),
    # --- ad 4 -----------------------------------------------------------------
    R('ad4.wordmark', 'ad4', 'SUNDAY HARMONY', 'serif', 500, (88, 62, 300, 84), 'light', 195, 'track'),
    R('ad4.tagline', 'ad4', 'BUILDING A BRIGHTER TOMORROW', 'sans', 500, (98, 86, 292, 100), 'light', 175, 'track'),
    R('ad4.nav1', 'ad4', 'CREDIT REPAIR', 'sans', 500, None, box=(80, 124, 188, 132),
      fit='track', group='ad4.nav'),
    R('ad4.nav2', 'ad4', 'FUNDING', 'sans', 500, None, box=(238, 124, 302, 132),
      fit='track', group='ad4.nav'),
    R('ad4.head1', 'ad4', 'STRONGER', 'sans', 800, (58, 148, 332, 186), 'light', 205),
    R('ad4.head2', 'ad4', 'CREDIT TODAY.', 'sans', 800, (58, 186, 332, 222), 'light', 205),
    R('ad4.script1', 'ad4', 'More Possibilities', 'mono_script', 700, (20, 216, 372, 262), 'light', 185,
      group='ad4.script', rotate=-4),
    R('ad4.script2', 'ad4', 'Tomorrow.', 'mono_script', 700, (150, 262, 330, 306), 'light', 185,
      group='ad4.script', rotate=-4),
    R('ad4.icon1', 'ad4', 'Buy a Home', 'sans', 400, (18, 391, 105, 406), 'light', 205, group='ad4.icon'),
    R('ad4.icon2', 'ad4', 'Get a Car', 'sans', 400, (112, 391, 185, 406), 'light', 205, group='ad4.icon'),
    R('ad4.icon3', 'ad4', 'Grow Your', 'sans', 400, (196, 391, 272, 406), 'light', 205, group='ad4.icon'),
    R('ad4.icon4', 'ad4', 'Invest in', 'sans', 400, (288, 391, 358, 406), 'light', 205, group='ad4.icon'),
    R('ad4.cta', 'ad4', "LET’S GET STARTED", 'sans', 700, None, box=(110, 461, 251, 472)),
    # --- ad 5 -----------------------------------------------------------------
    R('ad5.wordmark', 'ad5', 'SUNDAY HARMONY', 'serif', 500, (12, 42, 200, 64), 'dark', 120, 'track'),
    R('ad5.tagline', 'ad5', 'BUILDING A BRIGHTER TOMORROW', 'sans', 500, (18, 64, 196, 80), 'dark', 150, 'track'),
    # The three script lines interleave: the F of "Funding" rises past the descenders
    # of the line above it, so their ink boxes are read off the artwork by hand.
    R('ad5.script1', 'ad5', 'Credit', 'brush', 400, None, box=(23, 98, 167, 145)),
    R('ad5.script2', 'ad5', 'Repair &', 'brush', 400, None, box=(27, 152, 218, 195)),
    R('ad5.script3', 'ad5', 'Funding', 'brush', 400, None, box=(43, 203, 230, 257)),
    R('ad5.kicker', 'ad5', "IT’S POSSIBLE.", 'sans', 700, (44, 267, 205, 284), 'dark', 110, 'track'),
    R('ad5.list1', 'ad5', 'Repair Your Credit', 'sans', 500, (62, 300, 184, 320), group='ad5.list'),
    R('ad5.list2', 'ad5', 'Get Funded', 'sans', 500, (62, 334, 184, 353), group='ad5.list'),
    R('ad5.list3', 'ad5', 'Build Wealth', 'sans', 500, (62, 367, 184, 386), group='ad5.list'),
    R('ad5.list4', 'ad5', 'Create Freedom', 'sans', 500, (62, 400, 184, 420), group='ad5.list'),
    R('ad5.cta', 'ad5', 'APPLY NOW', 'sans', 700, None, box=(64, 471, 163, 483)),
    R('ad5.script4', 'ad5', 'Your Future', 'brush', 400, None, box=(258, 427, 393, 460),
      group='ad5.accent', rotate=-7),
    R('ad5.script5', 'ad5', 'Matters.', 'brush', 400, None, box=(257, 464, 374, 498),
      group='ad5.accent', rotate=-7),
]

HEADER = '''"""Type metrics solved from the original artwork. Generated by calibrate.py."""

# key -> text, substitute font, and the size/tracking/position that lands the run
# back on the box it occupies in the flattened collage.
METRICS: dict[str, dict] = {
'''


def main() -> None:
    solved: dict[str, dict] = {}
    missing = []
    for run in RUNS:
        entry = solve(run)
        if not entry:
            missing.append(run['key'])
            continue
        solved[run['key']] = entry
    unify(solved, RUNS)

    lines = [HEADER]
    for key, entry in solved.items():
        lines.append(
            f"    {key!r}: dict("
            f"text={entry['text']!r}, family={entry['family']!r}, weight={entry['weight']}, "
            f"x={entry['x']}, cx={entry['cx']}, baseline={entry['baseline']}, "
            f"size={entry['size']}, tracking={entry['tracking']}, rotate={entry['rotate']}),\n"
        )
    lines.append('}\n')
    (BUILD / 'metrics.py').write_text(''.join(lines), encoding='utf-8')
    print(f'wrote metrics.py with {len(RUNS) - len(missing)} runs')
    if missing:
        print('no ink found for:', ', '.join(missing))


if __name__ == '__main__':
    main()
