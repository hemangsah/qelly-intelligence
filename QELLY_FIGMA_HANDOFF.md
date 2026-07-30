# Qelly editable Figma handoff — Prompt 2B reconciled

Updated: 2026-07-30  
Product truth: repository design generation is available; native authenticated Figma execution is not available in this environment and is not claimed.

## Canonical Prompt 2B design contract

- 31 semantic plugin pages;
- 70 executable routes in `QELLY_ROUTE_INVENTORY.csv`;
- 429 governed frame records in `QELLY_SCREEN_MATRIX.csv`, through `QF-0429`;
- two default responsive records for every route: desktop 1440 and mobile 390;
- six-persona variants for 12 priority routes;
- eight data/failure states for 12 priority routes;
- 24 navigation, data and provenance overlays;
- representative editable Prompt 2B center/detail master frames in the deterministic Figma plugin;
- editable auto-layout structures, local paint/text styles and local semantic variables when the Figma Variables API is available;
- primary/secondary button variants, truth-state, table, chart, navigation, mobile-row, bottom-sheet, evidence and lifecycle patterns;
- no remote assets, external requests, flattened screenshots or proprietary reference material.

## Historical reconciliation

The former handoff recorded 61 routes and 411 frames. The pre-fresh Prompt 2B repository had 66 routes and 421 frame records. The final Prompt 2B implementation has 70 routes and 429 frame records.

The exact nine routes added to the historical Figma denominator are:

1. `calculator-center`
2. `india-finance`
3. `indicator-library`
4. `formula-library`
5. `saved-calculations`
6. `formula-detail`
7. `indicator-detail`
8. `calculator-detail`
9. `saved-calculation-detail`

The 18-frame increase is one desktop and one mobile default frame for each route. The old 61/411 values remain historical evidence and are not reused as current completion claims.

## Prompt 2B interaction and state mapping

The final design contract includes:

- calculator ready, validation-error, success, saved, exported, shared, offline and unavailable states;
- formula and indicator methodology/evidence panels;
- indicator insufficient-history and aligned-output states;
- saved-calculation empty, filtered, reopened, renamed, updated, duplicated, deleted, imported, rejected-import and backend-unavailable states;
- revision current, historical and restored states;
- desktop, tablet and mobile responsive rules;
- dark, porcelain light, OLED and high-contrast themes;
- full and reduced motion;
- keyboard operation, named controls, stable focus, accessible errors and text summaries for visualizations;
- explicit `DETERMINISTIC LOCAL`, `FRESH_REIMPLEMENTATION_2026`, `UNAVAILABLE` and other approved truth labels.

Every governed frame record includes route, purpose, viewport, persona, state, source requirements, backend dependencies, interaction notes, accessibility notes and responsive notes. The exact route-to-frame mapping is generated at `project-state/QELLY_PROMPT2B_FIGMA_ROUTE_FRAME_MAP.csv`.

## Generate and inspect

1. Open Figma Desktop and create a blank Design file.
2. Choose **Plugins → Development → Import plugin from manifest**.
3. Select `figma-plugin/manifest.json`.
4. Run **Qelly Governed Design System Generator**.
5. Confirm IBM Plex Sans is available; resolve any local Inter fallback before approval.
6. Review Prompt 2B center/detail masters, components, responsive behavior, truth labels, themes, reduced motion annotations and state coverage.
7. Record the native run separately; do not infer native execution from repository validation.

Re-running removes only pages marked by the generator itself. Repository validation uses `node --check figma-plugin/code.js`, `npm run inventory:design`, `npm run validate:design`, the route-frame mapping and representative browser screenshots. Native Figma execution remains a separate external action until an authenticated connector or desktop run is available.
