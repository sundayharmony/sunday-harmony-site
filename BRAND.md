# Sunday Harmony brand

Change colors here, then match the two files that cannot import this list.

| Token | Hex | Use |
|---|---|---|
| Accent | `#b8943f` | Buttons, labels, highlights |
| Accent soft | `#f0e6d3` | Soft panels, icon wells |
| Accent ink | `#7f6427` | Gold text on light backgrounds (`text-accent-ink`). Plain `#b8943f` fails contrast as text there; keep it for fills, borders, and text on dark |
| Text (ink) | `#1b1a17` | Headings, body, dark bands, primary buttons |
| Muted | `#4a463e` | Secondary copy |
| Dim | `#6a665e` | Hints (warm grey, darkened from `#a3a3a3` to pass WCAG AA on white and cream) |
| Border | `#e6dbc6` | Warm hairline borders |
| Background (cream) | `#fbf7f0` | Every page, public and portal |
| Background soft | `#f6efe2` | Alternating sections |
| Paper | `#fffdf8` | Cards, inputs, panels (`bg-white` renders as paper) |

Source of truth for the app build: `src/lib/brand-tokens.ts`.

Also set the same accent hex on `:root` in `src/styles/globals.css` (`--brand-accent`, `--brand-accent-soft`, `--brand-accent-ink`, `--brand-text`). Tailwind reads `brand-tokens.ts`.

Typefaces: Fraunces (600) for h1, h2 and `font-serif`; Montserrat for everything else. Logos: `public/logo-black.png` and `public/logo-white.png`.

Homepage type, motion, and spacing live in the same file (`brandType`, `brandMotion`, `brandSpace`). Public marketing pages apply them through `homeThemeVars()` inside `HomeMotion` (gold scroll line, desktop wheel smoothing). Admin, client, and partner portals keep their own layout but share the colors, type, buttons, cards, and motion below.

Photographs belong only where they show the service. The homepage uses three licensed files in `public/work/`: a logo being drawn, a website on a laptop, and a printed shop card. Do not repeat them on other pages.

| Group | What to edit | Use |
|---|---|---|
| Type | `brandType` | Display, titles, body, labels |
| Motion | `brandMotion` | Hover timing, scroll progress, Lenis |
| Space | `brandSpace` | Page padding, section gaps, max width |

Voice: plain English, no score guarantees, no local-city claim. Consulting is the public face. Credit repair and funding are separate doors.

## Design rules (2026-11-22)

Set from the approved homepage design. They apply to the whole system: public pages, client and partner portals, and admin. Global rules live in `src/styles/globals.css` and `tailwind.config.ts`; public-page extras in `src/components/home/home.module.css`.

1. **Ground.** Cream page (`#fbf7f0`), paper cards (`#fffdf8`), warm hairlines (`#e6dbc6`). No pure white pages, grey gradients, grid textures, or glows.
2. **Type.** Headings in Fraunces 600 with tight tracking (-0.015 to -0.02em). Body and UI in Montserrat. Headlines stay one color; no gold or italic words inside them on light grounds.
3. **Gold.** `#b8943f` for fills, rules, dots, and text on dark. Gold text on cream uses accent ink (`#7f6427`) or `#8a6416` so it passes contrast.
4. **Labels.** Section kickers are small uppercase gold-ink text with letter spacing, not chips.
5. **Buttons.** Primary actions are ink pills (`rounded-full`). Secondary actions are outlined pills. Minimum 44–48px tall.
6. **Cards.** 20–28px corners, paper fill, warm border. Clickable cards lift on hover: `translateY(-4 to -6px)`, gold border, soft shadow `0 18px 40px -24px rgba(27,26,23,.35)`. Use the `hover-lift` class.
7. **Motion.** One easing everywhere: `cubic-bezier(0.22, 1, 0.36, 1)`. Hovers and reveals run 400–500ms; Tailwind's default `transition` already uses this. Never swap content with `display: none` on hover; cross-fade with opacity and a small translate so nothing jumps. Expand details with `grid-template-rows: 0fr → 1fr`.
8. **Horizontal rails.** On desktop (fine pointer, 1024px+, motion allowed) a rail pins and moves sideways with vertical scroll (`RailScroller`). Phones keep native swipe with scroll snap.
9. **Touch.** Anything revealed on hover is shown up front on `(hover: none)` screens.
10. **Reduced motion.** Respect `prefers-reduced-motion`: no lifts, no pinned rails, near-zero transitions.
11. **Dark bands.** Ink `#1b1a17` with cream text and gold accents, used once or twice per page for process steps or the closing call to action.
12. **Check both sizes.** Every UI change is checked at desktop and about 390px wide before it ships.
