# Sunday Harmony brand

Change colors here, then match the two files that cannot import this list.

| Token | Hex | Use |
|---|---|---|
| Accent | `#b8943f` | Buttons, labels, highlights |
| Accent soft | `#f0ebe3` | Soft panels |
| Accent ink | `#7f6427` | Gold text on light backgrounds (`text-accent-ink`). Plain `#b8943f` fails contrast as text there; keep it for fills, borders, and text on dark |
| Text | `#0a0a0a` | Headings and body |
| Muted | `#525252` | Secondary copy |
| Dim | `#6a665e` | Hints (warm grey, darkened from `#a3a3a3` to pass WCAG AA on white and cream) |
| Border | `#e5e5e5` | Hairline borders |
| Background | `#ffffff` | Pages |
| Background soft | `#fafafa` | Alternating sections |

Source of truth for the app build: `src/lib/brand-tokens.ts`.

Also set the same accent hex on `:root` in `src/styles/globals.css` (`--brand-accent`, `--brand-accent-soft`, `--brand-accent-ink`, `--brand-text`). Tailwind reads `brand-tokens.ts`.

Typeface: Montserrat. Logos: `public/logo-black.png` and `public/logo-white.png`.

Homepage type, motion, and spacing live in the same file (`brandType`, `brandMotion`, `brandSpace`). Public marketing pages apply them through `homeThemeVars()` inside `HomeMotion` (gold scroll line, desktop wheel smoothing). Admin, client, and partner portals keep their own layout.

Photographs belong only where they show the service. The homepage uses three licensed files in `public/work/`: a logo being drawn, a website on a laptop, and a printed shop card. Do not repeat them on other pages.

| Group | What to edit | Use |
|---|---|---|
| Type | `brandType` | Display, titles, body, labels |
| Motion | `brandMotion` | Hover timing, scroll progress, Lenis |
| Space | `brandSpace` | Page padding, section gaps, max width |

Voice: plain English, no score guarantees, no local-city claim. Consulting is the public face. Credit repair and funding are separate doors.
