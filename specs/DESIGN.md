# DaktariScribe — Design system

> Captured by hand from `theme.css` / `app/globals.css` and the build spec §1.4–1.5.
> The `impeccable` and `ui-ux-pro-max` skills were not available when this was written;
> when they are, run `/impeccable document` and the ui-ux-pro-max design-system query
> (spec §1.2 step 3) and reconcile the results here.

## 1. Brand tokens (keep)

Defined in `app/globals.css` under `@theme inline` and used as Tailwind utilities
(`bg-primary`, `text-on-surface-variant`, …). `theme.css` is a stale duplicate and is not imported.

| Role | Token | Light | Notes |
| --- | --- | --- | --- |
| Primary (navy) | `--color-primary` | `#001d3d` | Sidebar, headings, primary buttons |
| Secondary (clinical teal) | `--color-secondary` | `#006b5c` | Active states, success, record actions |
| Surface | `--color-surface` | `#f6fafd` | App background |
| Card | `--color-surface-container-lowest` | `#ffffff` | Document-like panels |
| Body text | `--color-on-surface` | `#171c1f` | |
| Secondary text | `--color-on-surface-variant` | `#43474f` | 9.4:1 on white, so it's safe for body copy |
| Borders | `--color-outline-variant` | `#c3c6d0` | Decorative only; never the sole state signal |
| Error | `--color-error` | `#ba1a1a` | |
| Flag (uncertain) | `--color-flag` | `#b45309` | Amber; always paired with icon + text label |
| Flag surface | `--color-flag-container` | `#fef3c7` | |

### Dark theme

Same token names, re-mapped under `[data-theme="dark"]` and `prefers-color-scheme: dark`
in `app/globals.css` (surfaces become deep navy, primary text light, teal lightened to
`#44ddc1` for contrast). The header theme toggle writes `data-theme` on `<html>`.

## 2. Typography

- **Headlines:** Hanken Grotesk (`font-display-lg`, `font-headline-md`, `font-headline-sm`), loaded with `next/font`.
- **Body:** Inter (`font-body-lg/md/sm`), loaded with `next/font`.
- **Record IDs / status labels:** JetBrains Mono falls back to the system monospace (`font-label-status`).
- Minimum body size 14 px; form inputs 16 px on mobile (prevents iOS zoom).

## 3. Layout and controls

- Spacing scale: `stack-sm 8`, `stack-md 16`, `stack-lg 24`, `gutter 16`, `margin-mobile 16`, `margin-desktop 32`.
- **Touch targets ≥ 48 × 48 px** (`h-12`, `min-h-12`). Primary capture actions sit at the bottom on mobile, within thumb reach.
- Radius: small (`rounded-lg` ≈ 4 px, `rounded-xl` ≈ 8 px). Document-like, not bubbly.
- Shadows: minimal. Cards are separated by 1 px borders, like official forms.
- Tables: zebra-free, row dividers, sticky header on desktop; stack into cards below 640 px.

## 4. Status system (icon + text + colour, never colour alone)

| Status | Icon | Label |
| --- | --- | --- |
| Saved on device | `save` | Saved on device |
| Uploading | `cloud_upload` | Uploading |
| Transcribing | `graphic_eq` | Transcribing |
| Draft | `edit_note` | Draft |
| Processing | `hourglass_top` | Processing |
| In review | `rate_review` | Ready for review |
| Final | `verified` | Final |

Implemented once in `components/records/StatusBadge.tsx`.

Progress is a **determinate bar with plain steps**: *Uploading → Transcribing → Organising → Ready for review*. No spinners labelled "thinking".

## 5. Offline

- An offline banner is always visible when `navigator.onLine` is false.
- The header shows a pending-sync count (Phase 4).
- Every draft shows "Saved on device · hh:mm" after autosave.

## 6. Motion

Small and functional (≤ 200 ms fades and colour transitions). Everything respects
`prefers-reduced-motion: reduce` (global rule in `globals.css`). No looping decorative
animations on app screens.

## 7. No AI look (spec §1.5)

The product presents as a dependable clinical records tool.

**Never use**
- Words: AI, AI-powered, artificial intelligence, smart, magic, intelligent, copilot,
  assistant, agent, model, LLM, GPT, generate/generated, synthesise, clinical
  intelligence, hallucination, prompt.
- Icons: `auto_awesome`, `smart_toy`, `psychology`, brains, wands, chat bubbles for processing.
- Visuals: purple-to-blue gradients, glowing orbs, shimmer/"thinking" animations,
  typewriter streaming text, glassmorphism hero cards, neural patterns, software avatars.
- Patterns: chat UIs, "Ask DaktariScribe…", "✨ Improve" chips, streaming, "Regenerate".

**Say instead:** Organise notes · Prepare report · Transcribe · Draft · Organised draft ·
Re-process · Suggested code — confirm · Automatically translated (Reviewed by …).

Enforced by `npm run check:copy` (`scripts/check-copy.ts`, allowlist in
`scripts/copy-allowlist.txt`). Legal pages (`app/legal/**`) are excluded because they
must disclose automated processing plainly.

### Known debt
- The landing hero still uses a translucent "glass" feature card over a photo. It is a
  marketing surface, not an app screen; replace with solid navy cards during the
  landing redesign.
- `public/assets/DaktariScribe-Logo-Tagline.png` bakes in the old tagline "Voice-First
  Clinical Intelligence". It is no longer referenced; a new tagline asset is needed.

## 8. Exports

Formal report layout: logo, title, record ID, site, date, author, sections, fields table,
"Not recorded" for blanks, signature block, provenance line *"Prepared from original
field notes captured by [worker] on [date]."*, confidentiality notice, page numbers on
every page. Nothing in an export says "generated".

## 9. Per-screen loop

For each screen: build → critique → audit (P0/P1 fixed) → adapt (360 px / tablet /
desktop) → harden (error, empty, loading, offline, slow) → polish. Until the skills
are installed, this loop is run manually against §1.4 of the spec.
