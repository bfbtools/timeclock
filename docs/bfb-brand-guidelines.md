---
name: bfb-brand-guidelines
description: Back Forty Builders (BFB) brand identity, colors, typography, and design system tokens. Use this skill when creating any artifact, document, presentation, sign, internal tool, or web component for Back Forty Builders. Trigger when Adrienne says "BFB brand," "Back Forty brand," "Back Forty Builders style," or is working on any BFB deliverable. Applies to HTML, React, SVG, PDF, PPTX, and DOCX outputs.
---

# Back Forty Builders Brand Guidelines

## Overview

Back Forty Builders (BFB) is a general contracting company based in Johnson, Vermont. The brand is warm, industrial, and crafted — earthy terracotta and pine tones, condensed display type, and a utilitarian-but-refined feel suited to construction signage, internal tools, documents, and a future marketing site.

Built on the Untitled UI framework. Figma source file key: `PC6CTAGTvr1AJOAs6APpEI`. Variables live in two collections: **Primitives** (raw values) and **Semantic** (Light/Dark tokens that alias primitives). All hex values below were pulled directly from those collections.

**Keywords**: Back Forty Builders, BFB, Back Forty, brand colors, brand fonts, design system

---

## Color System

### Brand Colors

| Role | Name | Hex |
|---|---|---|
| **Primary** | Ember | `#DB563D` |
| Accent | Pine | `#2E5E4E` |
| Accent | Brass | `#DB942C` |
| Neutral (dark) | Forge | `#2D2E28` |
| Neutral (light) | Kraft | `#D6B07B` |

### Hue Ramps (Primitives)

- **Ember** (primary): 50 `#FCE8E1` · 100 `#F8D8CF` · 400 `#DB563D` (base) · 500 `#BB4832` · 600 `#9F3C29` · 700 `#843020` · 900 `#501A10`
- **Pine**: 50 `#DBEBE6` · 100 `#C8DCD6` · 400 `#2E5E4E` (base) · 500 `#254F41` · 600 `#1E4337` · 700 `#18392E` · 900 `#0C231C`
- **Brass**: 50 `#FCF0DB` · 100 `#F8E6C8` · 400 `#DB942C` (base) · 500 `#B77B23` · 600 `#9A681C` · 700 `#805616` · 900 `#4D330A`

### Neutrals

- **Warm**: 50 `#F7F0E6` · 100 `#F4EADB` · 500 `#B7986C` · 600 `#9A825D` · 700 `#7E6C4F` · 900 `#3D3B30`
- **Cool**: 50 `#EBF1EF` · 100 `#E1E8E6` · 500 `#667771` · 600 `#55645F` · 700 `#46524E` · 900 `#272E2B`

### Semantic Tokens (Light / Dark)

| Token | Light | Dark |
|---|---|---|
| bg/primary | `#FFFFFF` | `#181612` |
| bg/secondary | `#F7F0E6` | `#1C1B16` |
| surface/default | `#FFFFFF` | `#25231D` |
| text/primary | `#3B3830` | `#F7F0E6` |
| text/body | `#58524A` | `#EFE0CA` |
| text/secondary | `#6B6459` | `#E6CFAE` |
| text/tertiary | `#9B9488` | `#D6B07B` |
| text/placeholder | `#B8B0A4` | `#B7986C` |
| border/default | `#EFE0CA` | `#2F2D25` |
| border/strong | `#D6B07B` | `#38362C` |
| interactive/primary | `#DB563D` | `#DB563D` |
| interactive/primary-hover | `#BB4832` | `#E78D7B` |
| interactive/secondary-border | `#DB942C` | `#E8BA74` |
| status/success | `#34A853` | `#78C68D` |
| status/info | `#3B82C4` | `#7BACD9` |
| status/warning | `#E6A817` | `#E6A817` |
| status/error | `#DC3545` | `#E87983` |

---

## Typography

| Role | Font | Use |
|---|---|---|
| Display / headings | **Barlow Condensed** (Bold) | Titles, numbers, all-caps display |
| Body / UI / buttons | **Libre Franklin** | Body copy, labels, buttons |
| Accent | **Lora** (Italic) | Marketing / public-facing ONLY — never in utility UI |

### Type Scale (size / line-height)

**Display — Barlow Condensed Bold, all caps**
- H1 — 40 / 44
- H2 — 32 / 36
- H3 — 24 / 28
- H4 — 18 / 24
- Subhead — 13 / 18 (letter-spaced, all caps)

**Body — Libre Franklin**
- Body Large — 18 / 28
- Body Base — 16 / 26
- Body Small — 14 / 22
- Caption — 12 / 18
- Button — 12 / 16, Bold, ALL CAPS, ~1.8px tracking

**Accent — Lora Italic (public-facing only)**
- Accent Large — 32 / 40 (-2% tracking)
- Accent Medium — 22 / 30 (-1% tracking)
- Accent Small — 16 / 24

---

## Iconography

Material Symbols (Rounded weight) for BFB internal tools and apps. Icons inherit text color by default; use Ember `#DB563D` for primary/interactive icons.

---

## Buttons

Variants: **Primary, Secondary, Destructive, Link**. Sizes: **LG, MD, SM**. States: **Default, Hover, Focus, Disabled**. Button text is always Libre Franklin Bold, ALL CAPS, ~1.8px tracking. Corners ~8px, flat — no drop shadow or 3D edge.

- **Primary** — Fill Ember `#DB563D`; text white; hover `#BB4832`; disabled soft desaturated ember (light pink) with white text.
- **Secondary (outline)** — Fill white; border Brass `#DB942C`; hover background `#FCF0DB` (cream).
- **Destructive** — Fill `#DC3545`; hover `#B72B38`.
- **Link** — Ember `#DB563D` text, underline on hover.

---

## Notes

- Always use auto-layout on every Figma frame — no absolute positioning. Clip content off unless explicitly needed.
- Light theme is the default for daylight-legible jobsite tools; a full Dark-mode token set exists (see the Semantic table) for night/low-light use.
- For non-web outputs (PPTX/DOCX/PDF) where brand fonts aren't installed: substitute Barlow Condensed with a condensed bold (e.g., Oswald or Arial Narrow Bold) and Libre Franklin with Helvetica/Arial.
