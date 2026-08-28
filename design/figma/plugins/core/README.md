# Qelly governed Figma generator

This development plugin creates the editable Qelly design-system handoff without network access or bundled proprietary assets.

1. Open Figma Desktop and create a blank design file.
2. Choose **Plugins → Development → Import plugin from manifest**.
3. Select `design/figma/plugins/core/manifest.json`.
4. Run **Qelly Governed Design System Generator**.

The generator creates 25 named pages and exactly 411 meaningful editable frames:

- 25 foundation frames;
- 122 desktop/mobile route frames for the 61 executable routes;
- 144 persona-priority frames;
- 96 loading, empty, degraded, permission, and offline frames;
- 24 navigation, component, and provenance overlays.

Every screen frame stores route, purpose, viewport, persona, state, source requirements, backend dependencies, interaction notes, accessibility notes, and responsive notes as editable content and plugin data. Re-running removes only pages that this plugin marked as generated.
