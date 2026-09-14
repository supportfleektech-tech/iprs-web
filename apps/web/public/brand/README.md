# Brand assets — IPRS shield mark

Source of truth: repo-root `transparent-logo.png` (861×865 RGBA, full lockup on transparency).

## Derivatives (generated 2026-09-14, PIL/LANCZOS)

- `mark.png` — shield-mark crop `(x 220–673, y 29–480)`, squared + padded, 512px master. Light surfaces, PDF embed.
- `lockup-dark.png` — full file as-is. **Dark surfaces only** (white wordmark).
- `favicon-{16,32,48}.png` — from mark master.
- `apple-touch-icon.png` — 180px, mark at 68% on `#0A1628` (Apple ignores transparency).
- `icon-{192,512}.png` + `icon-{192,512}-maskable.png` — mark at 68% on full-bleed `#0A1628`.
- `og.png` — 1200×630, lockup fit-width 960 centered on `#0A1628`.

## Rules

- Never use `lockup-dark.png` on light backgrounds (white `IPRS` wordmark is invisible there) — use `mark.png` + text instead.
- Never stretch: `BrandMark` (`@fleek/ui`) enforces aspect ratios.
- Regeneration: crop box above; paste centered on transparent square; LANCZOS downscales.
