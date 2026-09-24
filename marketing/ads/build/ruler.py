"""Look at a region of the original artwork, or of a rebuild, with a ruler on it.

    python3 ruler.py ad5 20 270 260 430           # original crop, artboard units
    python3 ruler.py ad5 20 270 260 430 --render  # same window from the rebuild
    python3 ruler.py ad5 30 460 175 495 --probe   # ink bounds, printed

Used while fitting the layouts: the gridlines are drawn in artboard units, so a
number read off the image can be pasted straight into `specs.py`. `--probe`
reports the bounds numerically, which is the only reliable way to read the
position of something as small as a button label.
"""

from __future__ import annotations

import argparse
import io

import cairosvg
import numpy as np
from PIL import Image, ImageDraw

from photos import CELLS, SOURCE, _ink_mask
from specs import ALL_ADS


def artboard(slug: str, *, render: bool) -> Image.Image:
    box = CELLS[slug]
    if not render:
        return Image.open(SOURCE).convert('RGB').crop(box)
    ad = ALL_ADS[int(slug[-1]) - 1]()
    png = cairosvg.svg2png(
        bytestring=ad.svg().encode(),
        output_width=box[2] - box[0],
        output_height=box[3] - box[1],
    )
    return Image.open(io.BytesIO(png)).convert('RGB')


def ruled(image: Image.Image, window: tuple[int, int, int, int], zoom: int, step: int) -> Image.Image:
    x0, y0, x1, y1 = window
    view = image.crop(window).resize(((x1 - x0) * zoom, (y1 - y0) * zoom), Image.NEAREST)
    draw = ImageDraw.Draw(view, 'RGBA')
    for x in range(x0 - x0 % step, x1, step):
        px = (x - x0) * zoom
        heavy = x % (step * 5) == 0
        draw.line([(px, 0), (px, view.height)], fill=(255, 0, 128, 150 if heavy else 60), width=1)
        if heavy:
            draw.text((px + 2, 2), str(x), fill=(255, 0, 128, 255))
    for y in range(y0 - y0 % step, y1, step):
        py = (y - y0) * zoom
        heavy = y % (step * 5) == 0
        draw.line([(0, py), (view.width, py)], fill=(0, 180, 255, 150 if heavy else 60), width=1)
        if heavy:
            draw.text((2, py + 2), str(y), fill=(0, 160, 255, 255))
    return view


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('slug')
    parser.add_argument('box', nargs=4, type=int, metavar=('X0', 'Y0', 'X1', 'Y1'))
    parser.add_argument('--render', action='store_true')
    parser.add_argument('--probe', action='store_true', help='print ink bounds instead')
    parser.add_argument('--contrast', action='store_true',
                        help='find ink by local contrast, for type over photography')
    parser.add_argument('--mode', choices=('dark', 'light'), default='dark')
    parser.add_argument('--threshold', type=int, default=110)
    parser.add_argument('--delta', type=int, default=9)
    parser.add_argument('--stroke', type=int, default=25)
    parser.add_argument('--zoom', type=int, default=3)
    parser.add_argument('--step', type=int, default=4)
    parser.add_argument('--out', default='/tmp/ruler.png')
    args = parser.parse_args()

    image = artboard(args.slug, render=args.render)
    if args.probe:
        x0, y0, x1, y1 = args.box
        grey = np.asarray(image.convert('L'))[y0:y1, x0:x1]
        if args.contrast:
            hit = _ink_mask(grey, args.mode, args.delta, args.stroke, 0) > 0
        elif args.mode == 'dark':
            hit = grey.astype(int) < args.threshold
        else:
            hit = grey.astype(int) > args.threshold
        if not hit.any():
            print('no ink in window')
            return
        ys, xs = np.where(hit)
        print(f'box=({x0 + xs.min()}, {y0 + ys.min()}, {x0 + xs.max()}, {y0 + ys.max()})  '
              f'w={xs.max() - xs.min() + 1} h={ys.max() - ys.min() + 1}')
        return

    view = ruled(image, tuple(args.box), args.zoom, args.step)
    view.save(args.out)
    print(args.out, view.size)


if __name__ == '__main__':
    main()
