# Sunday Harmony ad set

Five editable rebuilds of the ads in `source/ad-collage.png`, one file per ad.

    out/01-credit-repair-funding-solutions.svg   .psd
    out/02-fix-your-credit-unlock-your-future.svg   .psd
    out/03-real-solutions-for-your-financial-goals.svg   .psd
    out/04-stronger-credit-today.svg   .psd
    out/05-credit-repair-funding-its-possible.svg   .psd

The collage is a flattened image, so nothing could be extracted from it. Each ad
is rebuilt instead: the photography is lifted out of the collage and the type,
logo, buttons, icons and bands are redrawn as vectors on top of it.

## Which file to open

- **Illustrator:** open the `.svg`. Every group in the layer panel is one part of
  the ad, and all type is live text you can retype, recolour and resize.
- **Photoshop:** open the `.psd`. It has the same layer names, one raster layer
  each, at 2x the artboard (so ad 1 is 1630x1372). Type is not live in the PSD;
  edit wording in the SVG, or set new type over the photo layer.

Both files embed the photographic plate, so they travel on their own.

## Fonts

The originals were supplied as pixels, so the exact faces are unknown. These free
substitutes were fitted to the measured letterforms:

| Role | Font |
| --- | --- |
| Headlines, body, buttons | Archivo SemiCondensed |
| "SUNDAY HARMONY" wordmark | Cormorant Garamond Medium |
| Brush script (ads 3, 5) | Kaushan Script |
| Monoline script (ads 1, 4) | Dancing Script Bold |

Copies are in `fonts/`; install them before editing so the text does not reflow.
Swapping in the site's brand font is a one-line change in `build/brand.py`.

## Rebuilding

    cd marketing/ads/build
    python3 photos.py     # cleaned photographic plates -> ../assets
    python3 calibrate.py  # measure the artwork -> metrics.py
    python3 build.py      # SVG + PSD -> ../out, comparisons -> ../proofs

`build.py --svg`, `--psd` and `--proof` each do one step. `proofs/` holds each
rebuild beside the original crop, which is how the layouts were fitted.
`ruler.py` measures a region of either one:

    python3 ruler.py ad5 16 268 260 432            # gridded image of the artwork
    python3 ruler.py ad5 30 460 175 495 --probe    # ink bounds, printed
    python3 ruler.py ad5 16 86 245 278 --render    # same window, rebuilt

Requires `pillow`, `opencv-python`, `cairosvg`, `pytoshop` and `fonttools`.

## Known differences from the original

- The handwriting on the notebook in ad 2 is part of that photograph and was left
  in it, because redrawing it flat would read worse than the original.
- Photography behind type had to be repaired where the flattened lettering sat on
  it. The repair follows the letter shapes, so the picture survives, but those
  areas are slightly smoother than the surrounding photo.
