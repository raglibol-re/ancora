# Handoff: ancora brand mark, wordmark and app icons

## Overview
Final logo system for **ancora**, a stablecoin business account for organizations on Stellar. The mark is a brass shield (custody, rules) with an anchor cut out of it in negative space, and a four-point starlight star breaking the shield's top edge where an anchor's ring would be. On Stellar, "anchors" connect bank money to the network; the star in the ring is that reference, kept quiet.

## About these files
Everything in `svg/` and `icons/` is **final, production-ready**: use the SVGs and PNGs as they are. The `Logo Directions.dc.html` design file (and `geometry.js`) in the parent project are the design source, not something to ship. Rounds 1–3 in that file are superseded; **round 4, option 5a, is the approved mark** and is what the exports contain.

Brand name is always written **ancora**: lowercase, plain "a", no accent, no capital.

## Files

### `svg/`
| File | Use |
| --- | --- |
| `mark-on-dark.svg` | Brass shield, starlight star, night-blue background (64×64 viewBox) |
| `mark-on-light.svg` | Night-blue shield, brass star, cool-light background |
| `mark-mono-dark.svg` | One colour (night blue) on cool light |
| `mark-mono-light.svg` | One colour (starlight) on night blue |
| `mark-transparent-brass.svg` | Brass shield with the anchor and star keyline **cut through** (mask) so any background shows; starlight star. For dark surfaces. |
| `mark-transparent-night.svg` | Same, night-blue shield + brass star. For light surfaces. |
| `favicon.svg` | 16 px cut of the mark on a rounded night square (use as `<link rel="icon" type="image/svg+xml">`) |
| `wordmark-dark.svg` / `wordmark-light.svg` | "ancora" in IBM Plex Sans Medium, −3.5 % tracking (live text, see note) |
| `lockup-dark.svg` / `lockup-light.svg` | Horizontal lockup: mark + wordmark, gap = ⅓ mark width |

**Wordmark note:** the wordmark/lockup SVGs use live `<text>` in IBM Plex Sans 500. The app already loads IBM Plex Sans, so inline SVG renders correctly. For contexts without the font (email, social, print), convert to outlines once (Figma/Illustrator/Inkscape → Object to Path) and commit `wordmark-*-outlined.svg` alongside.

### `icons/`
| File | Spec |
| --- | --- |
| `icon-1024.png` | App Store / source icon, square, opaque night blue, mark at 81 % |
| `icon-512.png`, `icon-192.png` | PWA `purpose: "any"` |
| `maskable-512.png` | PWA `purpose: "maskable"`; mark sits inside the central 80 % safe zone |
| `apple-touch-icon-180.png` | Square, no transparency, no rounded corners (iOS masks it) |
| `favicon-32.png`, `favicon-16.png` | Size-specific cuts (thicker anchor, larger star) on a rounded night square |

Suggested `manifest.webmanifest` entries:
```json
"icons": [
  { "src": "/brand/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/brand/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/brand/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
],
"background_color": "#0B1730",
"theme_color": "#0B1730"
```
Head tags:
```html
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon-180.png">
```

## Construction (for any future redraw)
64-unit grid.
- **Shield:** x 12–52 (40 wide), top y = 14, straight sides to y = 34, then one circular arc (r 20, centre 32,34) to the point at y = 54.
- **Anchor (cut-out):** shank 5 wide, from y = 26 down into the bowl. Bowl is a circular band, centre (32, 36), outer r 12.5, inner r 7.5, swept from −4.6° to 184.6° (ends cut square just above horizontal). Optical centre sits 1 unit high.
- **Star:** 4 points, concave sides, centre (32, 14), outer r 9.5, inner r 3.4, with a 2.4-unit keyline in the ground colour (`paint-order: stroke`) so it reads on any surface.
- **Size cuts:** at ≤ 40 px use shank 7 / bowl r 13.5 / star r 11 (keyline 3). At ≤ 20 px use shank 9 / bowl r 14 / star r 13 (keyline 3.5). Exported PNGs already apply these.

`geometry.js` in the project root generates all paths from these numbers.

## Colours
| Name | Hex | Role |
| --- | --- | --- |
| Night Blue | `#0B1730` | Primary ground, icon background, shield on light |
| Deep Tide | `#14284F` | Raised surfaces; top of the iOS icon gradient (`#14284F → #0B1730`) |
| Brass Gold | `#C9A24A` | Shield on dark; the accent. 7.5:1 on Night Blue |
| Brass Deep | `#A8832F` | Brass for small marks on light grounds (4.5:1 on `#EEF2F8`) |
| Starlight | `#E8ECF5` | The star on dark; text on dark |
| Cool Light | `#EEF2F8` | Light-mode ground |

Contrast: brass on night 7.5:1, starlight on night 15:1, night on cool light 15.3:1. All pass WCAG AA for graphics (3:1) and text (4.5:1).

## Rules
- **Minimum size:** mark 16 px (use the favicon cut), lockup 24 px tall. Below 40 px use the small cuts, never scale the master.
- **Clear space:** the star's height (≈ 19 units of 64, i.e. 30 % of the mark) on every side of the mark or lockup.
- **Lockup proportions:** mark height = wordmark cap height × 1.25; gap between mark and wordmark = ⅓ of the mark width; baseline of "ancora" aligns with the shield's lower third.
- **Colour pairs only:** brass shield + starlight star on dark; night shield + brass star on light; one-colour versions for print/engraving. Never brass on brass, never a gradient inside the shield.
- **Don't:** rotate, add a crossbar/stock, add rope or chain, outline the shield, place the star elsewhere, or set the name with a capital or an accent.

## Rationale (README / pitch deck)
> The ancora mark is a shield with an anchor held inside it. The shield is the organization's own rules: who may move money, how much, with whose approval. The anchor is the money staying where it belongs. Where an anchor's ring would be sits a single star, a quiet nod to Stellar, where "anchors" are the services that connect everyday money to the network. Drawn in brass on night blue, it is meant to feel like a well-made instrument rather than a crypto badge, and to sit calmly on a phone home screen next to any modern banking app.

## Deviations from the brief
- The approved mark is a **shield with negative-space anchor**, chosen over an open anchor in rounds 2–3 because outline anchors read as generic icons at app-icon size. Idea kept: star as ring, no stock, no rope.
- Wordmark SVGs use live text rather than outlines (see note above).
- "Cool light background" was taken as `#EEF2F8` as specified; the earlier parchment `#F4EEE1` from the identity board is deprecated for the product UI.
