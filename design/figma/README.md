# Figma sources

This directory is the single home for editable Figma source and its governed matrices.

- `plugins/core/` — the primary Qelly design-system generator.
- `plugins/brand-foundations/` — the brand/logo foundation generator.
- `plugins/theme/` — the Theme Intelligence generator.
- `QELLY_FIGMA_MASTER_SPEC.md`, `QELLY_THEME_INTELLIGENCE_FIGMA.md` — execution contracts.
- `QELLY_FIGMA_*_MATRIX.csv` — Figma-specific frame/component inventories.

Each plugin is self-contained: its `manifest.json` points to the adjacent `code.js`. The plugins are deterministic source generators; native Figma execution and approval remain external actions. Runtime route and screen inventories live in `../inventory/`, while generated review packages belong under `outputs/` and are not source.
