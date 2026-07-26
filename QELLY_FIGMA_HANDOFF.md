# Qelly editable Figma handoff

No authenticated Figma connector is available in this environment. The repository therefore contains a deterministic, network-free development plugin at `figma-plugin/manifest.json`.

## Verified generator contract

- 25 required named pages;
- 411 meaningful editable frames;
- editable auto-layout structures;
- local paint and text styles;
- local semantic variables when the Figma Variables API is available;
- primary button and truth-state components;
- desktop/mobile route frames for all 61 executable routes;
- six-persona variants for 12 priority routes;
- eight data/failure states for 12 priority routes;
- 24 navigation, data, and provenance overlays;
- no remote assets, external requests, flattened screenshots, or proprietary reference material.

Every screen frame includes route, purpose, viewport, persona, state, source requirements, backend dependencies, interaction notes, accessibility notes, and responsive notes. The same contract is recorded in `QELLY_SCREEN_MATRIX.csv`.

## Generate

1. Open Figma Desktop and create a blank Design file.
2. Choose **Plugins → Development → Import plugin from manifest**.
3. Select `figma-plugin/manifest.json`.
4. Run **Qelly Governed Design System Generator**.

Re-running removes only pages marked by the generator itself. `node --check figma-plugin/code.js` and `npm run validate:design` validate repository syntax and the 411-frame contract. A native Figma run and visual inspection remain external handoff actions; the repository does not claim they occurred here.
