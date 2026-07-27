# Qelly font, surface and continuous-corner Figma master specification

## Execution and evidence boundary

Run the repository plugin in `figma-plugin/`. It generates 31 editable semantic pages, dark and warm-porcelain variables, radius and motion variables, text and paint styles, component definitions, variants, responsive desktop/mobile master frames and focused correction review boards.

The target product typography is **Geist Sans Variable** for display/UI and **Geist Mono Variable** only for timestamps, identifiers, formulas, provenance and tabular evidence. The plugin attempts to load Geist from the local Figma environment and falls back to Inter only when Geist is unavailable; that fallback must be replaced or resolved before final Figma approval. No hosted Figma URL or exported frame is claimed by CI.

## Pages

01 Cover; 02 Research; 03 Brand; 04 Color; 05 Typography; 06 Grid; 07 Motion; 08 Icons; 09 Navigation; 10 Components; 11 Tables; 12 Charts; 13 Heatmaps; 14 Provenance; 15 Personas; 16 Public Home; 17 Market Overview; 18 Asset Rankings; 19 Asset Detail; 20 Derivatives; 21 Options; 22 Order Flow; 23 Exchanges; 24 Research; 25 Portfolio; 26 Quant Workbench; 27 Operations; 28 Trust; 29 Mobile; 30 States; 31 Handoff.

## Phase 0 editable master frames

- Public Home desktop/mobile
- Market Overview desktop/mobile
- Asset Rankings desktop/mobile
- BTC Asset Page desktop/mobile
- Derivatives Overview desktop/mobile
- Funding Monitor desktop/mobile
- Liquidation Monitor desktop/mobile
- Liquidation Heatmap desktop/mobile
- Options Intelligence desktop/mobile
- Research Workspace desktop/mobile
- Portfolio Intelligence desktop/mobile
- Decision Provenance desktop/mobile

Every frame records viewport, task mode, data boundary, accessibility intent, responsive behavior, font target and motion contract through semantic naming and plugin data.

## Typography system

- Page title: 42–52px desktop, 32–38px tablet, 28–32px mobile; optical weight approximately 590; negative tracking.
- Section title: 22–28px; weight 560–600.
- Module title: 15–18px; weight 550–590.
- Metrics: 20–38px with tabular lining numerals.
- Body: 14.5–16px, weight 400–460, line height 1.45–1.6.
- Table cells: 13–14px; headers 11.5–12.5px with uppercase used only when semantically useful.
- Avoid 700/800 as default hierarchy. Use scale, tone and spacing before weight.

## Surface and border system

- Canvas `#070507`
- Base `#0B090B`
- Section `#0F0D10`
- Panel `#131116`
- Interactive `#17141A`
- Floating `#1C181E`
- Burgundy is reserved for identity and active emphasis.
- Ordinary panels use tonal separation and spacing; borders are subtle structural aids, not card outlines.
- Analytical surfaces use minimal elevation. Layered soft shadows are reserved for palettes, sheets, drawers and menus.

## Continuous-corner variables

- 4 tiny indicators
- 6 tags
- 8 dense controls
- 10 buttons/results
- 12 inputs/compact panels
- 14 standard panels
- 16 major analytical modules
- 20 floating navigation and command palette
- 24 modals and mobile sheets
- 28 cinematic media only
- 999 chips only

Nested geometry is explicit: 20px palette → 12px search → 10px result → 8px shortcut; 16px chart → 10px controls → 8px timeframe segments.

## Component requirements

- Button variant set with restrained primary and tonal secondary.
- Search/input with custom indicator and visible focus state.
- Command palette with Recent, Navigation, Assets and Actions groups; icon, title, description and shortcut hierarchy.
- Continuous market pulse surface and mobile horizontal pulse rail.
- Institutional table with 13–14px rows, sticky hierarchy, subtle dividers and evidence actions.
- Realistic deterministic OHLC chart with volume, axes, crosshair, tooltip and source/freshness footer.
- Expandable mobile asset row.
- Mobile filter/column bottom sheet.
- Floating dock and navigation drawer.
- Compact truth status, six personas, provenance and Explain This Move patterns.

## Required correction review boards

- Typography: rejected stack, Geist, Manrope, Plus Jakarta Sans and final Geist selection.
- Hard bordered card versus tonal surface hierarchy.
- 4/8/12/16/20/24 corner system.
- Nested-radius examples.
- Command palette: rejected current, new desktop and new mobile/bottom-sheet behavior.
- Warm porcelain light mode and dark mode.
- Motion annotations including reduced-motion removal of travel.

## Review boundary

The generator is executable and its frames are editable, but every generated master frame and focused review board must be opened and visually reviewed in Figma before any quality claim. Frame count is not a quality measure. CI evidence is generator-derived and must never be represented as an export from a hosted Figma file.
