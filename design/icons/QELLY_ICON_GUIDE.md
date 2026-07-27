# Qelly icon guide

Registry: `apps/web/public/assets/icon-registry.mjs`

## Construction

- 24×24 coordinate grid.
- 1.7px default stroke.
- Round line caps and joins.
- 16–20px optical sizes in application chrome.
- Fill is reserved for selected watchlist and compact status dots.
- No emoji or Unicode glyph is used as an application icon in the premium shell or Asset Rankings route.

## Semantics

- `explain`: Explain This Move / evidence interpretation.
- `evidence`: Decision Provenance and evidence graph.
- `markets`: market regime and market overview.
- `derivatives`: OI, funding, liquidation, basis, and options domains.
- `trust`: source quality, methodology, and provider assurance.
- `operations`: provider/runtime operations.
- `discovery`: rankings, categories, exchanges, and leaderboards.
- `terminal`: dense analytical mode.
- `research`: evidence-rich research mode.

## Accessibility

Decorative icons are emitted with `aria-hidden="true"`. Standalone icon buttons carry an explicit accessible label. Icon meaning is never the only state cue: selected states include text, `aria-pressed`, contrast, and focus treatment.

## Originality

The registry is an original small SVG line system. It does not copy reference-product icon artwork or proprietary glyph sets.
