# Qelly responsive standard

## Target widths

| Width | Intended behavior |
| --- | --- |
| 360px | Small mobile, single essential flow |
| 390px | Primary mobile validation profile |
| 430px | Large mobile |
| 768px | Tablet portrait |
| 1024px | Tablet landscape and compact two-panel workspaces |
| 1280px | Laptop |
| 1440px | Primary desktop design viewport |
| 1728px | Wide desktop |
| 1920px+ | Analytical-wide layouts with bounded line lengths |

## Mobile

- Use the compact bottom navigator and category drawer.
- Replace wide filter bars with an explicit filter sheet.
- Convert wide tables into prioritised cards or a labelled horizontal grid; expose column selection.
- Keep charts touch-safe and prevent vertical page gestures from being trapped.
- Keep source, freshness, confidence, and fallback reason visible.
- Use fixed critical actions only when they do not obscure content or the safe area.

## Tablet

- Use compact two-panel layouts in landscape.
- Allow the category navigator to expand temporarily; do not reserve an oversized permanent rail.
- Keep comparison and evidence drawers dismissible.
- Preserve desktop table semantics where space permits.

## Desktop and analytical-wide

- Keep table headers and asset identity context sticky.
- Freeze the first identity column only when it does not create an inaccessible reading order.
- Bound public/research line length while allowing analytical tables and charts to use width.
- Avoid expanding cards merely to fill wide screens.

## Reflow rules

- Components use content-aware grids and `minmax(0,1fr)`.
- Essential controls wrap before labels truncate.
- Asset names wrap to two lines; identifiers use controlled overflow.
- Financial values remain aligned and do not wrap inside a single value/unit pair.
- No route may create unexplained horizontal page overflow.

The 411-frame matrix in `QELLY_SCREEN_MATRIX.csv` supplies desktop/mobile route coverage, selected persona variants, states, and overlays. Browser/device verification remains a release gate.
