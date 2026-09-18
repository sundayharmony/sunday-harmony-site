"""Emit the editable ad files.

    python3 build.py            # SVG (Illustrator) + PSD (Photoshop) + proofs
    python3 build.py --svg      # SVG only
    python3 build.py --proof    # side-by-side proof against the original collage

Each named layer in `specs.py` becomes a group in the SVG and a pixel layer in
the PSD, so the same layout definition drives both deliverables.
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image
from pytoshop import enums, image_data
from pytoshop.user import nested_layers

from photos import CELLS, SOURCE
from specs import ALL_ADS

OUT = Path(__file__).resolve().parent.parent / 'out'
PROOFS = Path(__file__).resolve().parent.parent / 'proofs'


def render(svg: str, width: int, height: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=width, output_height=height)
    return Image.open(io.BytesIO(png)).convert('RGBA')


def write_psd(ad, path: Path) -> None:
    width = round(ad.width * ad.scale)
    height = round(ad.height * ad.scale)
    layers = []
    for layer in ad.layers:
        img = render(ad.svg(only=layer.name), width, height)
        arr = np.asarray(img)
        alpha = arr[..., 3]
        if not alpha.any():
            continue
        channels = {
            0: arr[..., 0].copy(),
            1: arr[..., 1].copy(),
            2: arr[..., 2].copy(),
            -1: alpha.copy(),
        }
        layers.append(
            nested_layers.Image(
                name=layer.name,
                visible=True,
                top=0,
                left=0,
                channels=channels,
                opacity=255,
            )
        )
    # Photoshop lists the last written layer on top, so reverse to keep paint order.
    psd = nested_layers.nested_layers_to_psd(
        layers[::-1],
        color_mode=enums.ColorMode.rgb,
        compression=enums.Compression.zip,
        size=(width, height),
    )
    # The flattened preview is what thumbnails and non-layered readers show, and it
    # is not derived from the layers, so it has to be supplied.
    flat = np.asarray(render(ad.svg(), width, height).convert('RGB'))
    psd.image_data = image_data.ImageData(
        channels=np.ascontiguousarray(flat.transpose(2, 0, 1)),
        compression=enums.Compression.zip,
    )
    with path.open('wb') as fh:
        psd.write(fh)


def write_proof(ad, slug_key: str, path: Path) -> None:
    """Rebuild next to the original crop, so drift is easy to spot."""
    collage = Image.open(SOURCE).convert('RGB')
    original = collage.crop(CELLS[slug_key])
    rebuilt = render(ad.svg(), original.width, original.height).convert('RGB')
    gap = 12
    sheet = Image.new('RGB', (original.width * 2 + gap, original.height), 'white')
    sheet.paste(original, (0, 0))
    sheet.paste(rebuilt, (original.width + gap, 0))
    sheet.save(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--svg', action='store_true', help='write SVG only')
    parser.add_argument('--psd', action='store_true', help='write PSD only')
    parser.add_argument('--proof', action='store_true', help='write comparison proofs only')
    args = parser.parse_args()
    everything = not (args.svg or args.psd or args.proof)

    OUT.mkdir(parents=True, exist_ok=True)
    if args.proof or everything:
        PROOFS.mkdir(parents=True, exist_ok=True)

    for index, factory in enumerate(ALL_ADS, start=1):
        ad = factory()
        slug_key = f'ad{index}'

        if args.svg or everything:
            svg_path = OUT / f'{ad.slug}.svg'
            svg_path.write_text(ad.svg(), encoding='utf-8')
            print(f'{svg_path.name}  {svg_path.stat().st_size // 1024} KB '
                  f'({len(ad.layers)} layers)')

        if args.psd or everything:
            psd_path = OUT / f'{ad.slug}.psd'
            write_psd(ad, psd_path)
            print(f'{psd_path.name}  {psd_path.stat().st_size // 1024} KB')

        if args.proof or everything:
            proof_path = PROOFS / f'{ad.slug}-proof.png'
            write_proof(ad, slug_key, proof_path)
            print(f'{proof_path.name}')


if __name__ == '__main__':
    main()
