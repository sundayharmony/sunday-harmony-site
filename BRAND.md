# Sunday Harmony brand

Change colors here, then match the two files that cannot import this list.

| Token | Hex | Use |
|---|---|---|
| Accent | `#b8943f` | Buttons, labels, highlights |
| Accent soft | `#f0ebe3` | Soft panels |
| Text | `#0a0a0a` | Headings and body |
| Muted | `#525252` | Secondary copy |
| Dim | `#a3a3a3` | Hints |
| Border | `#e5e5e5` | Hairline borders |
| Background | `#ffffff` | Pages |
| Background soft | `#fafafa` | Alternating sections |

Source of truth for the app build: `src/lib/brand-tokens.ts`.

Also set the same accent hex on `:root` in `src/styles/globals.css` (`--brand-accent`, `--brand-accent-soft`, `--brand-text`). Tailwind reads `brand-tokens.ts`.

Typeface: Montserrat. Logos: `public/logo-black.png` and `public/logo-white.png`.

Homepage type, motion, and spacing live in the same file (`brandType`, `brandMotion`, `brandSpace`). Public marketing pages apply them through `homeThemeVars()` inside `HomeMotion` (gold scroll line, desktop wheel smoothing, the package rail). Admin, client, and partner portals keep their own layout.

Photographs for the public pages are slots in `src/lib/work-photos.ts`. Each slot has alt text. `src` stays empty until a generated image is saved and the path is set. The frames use the warm accent wash, not a cold gray.

| Group | What to edit | Use |
|---|---|---|
| Type | `brandType` | Display, titles, body, labels |
| Motion | `brandMotion` | Hover timing, scroll progress, Lenis, the package rail |
| Space | `brandSpace` | Page padding, section gaps, max width |
| Photos | `work-photos.ts` | Public page photographs and alt text |

Voice: plain English, no score guarantees, no local-city claim. Consulting is the public face. Credit repair and funding are separate doors.
