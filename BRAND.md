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

Homepage type, motion, and spacing live in the same file (`brandType`, `brandMotion`, `brandSpace`). The public homepage applies them through `homeThemeVars()`. Change the book, not the homepage styles. Other pages keep their current layout.

| Group | What to edit | Homepage use |
|---|---|---|
| Type | `brandType` | Display, titles, body, labels |
| Motion | `brandMotion` | Hover timing, scroll progress, Lenis |
| Space | `brandSpace` | Page padding, section gaps, max width |

Voice: plain English, no score guarantees, no local-city claim. Consulting is the public face. Credit repair and funding are separate doors.
