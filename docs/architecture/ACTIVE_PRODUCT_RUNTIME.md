# Active product runtime

This document is the editing map for the current Qelly production surface.

## Customer-facing entry points

- `apps/web/public/index.html` — static application shell and final stylesheet/module order.
- `apps/web/public/assets/qelly-public-runtime.mjs` — product header, public market home and runtime boot.
- `apps/web/public/assets/qelly-production-shell.mjs` — shared navigation, theme and route convergence.
- `apps/web/public/assets/qelly-product-experience.css` — final visual authority for both dark and light modes.
- `apps/web/public/assets/qelly-product-experience.mjs` — shared interaction behavior.
- `apps/web/public/assets/routes/` — customer route renderers.
- `apps/web/public/qelly-service-worker.js` — offline public shell.

## Backend and platform entry points

- `functions/api/v1/` — Cloudflare Pages API surface.
- `functions/_lib/` — runtime, identity, provider, data and readiness modules.
- `src/public-runtime/` — portable runtime foundations, provider adapters and telemetry.
- `apps/edge/qelly-public-api-worker.mjs` — standalone Worker reference implementation.
- `packages/contracts/qelly-public-runtime.openapi.json` — public API contract.
- `deploy/cloudflare/wrangler.public-runtime.example.toml` — Worker deployment example.
- `.github/workflows/qelly-public-runtime.yml` — release-branch validation and live exact-SHA verification.

## Naming policy

New runtime files use durable product or capability names, never prompt numbers or rolling visual-version names. Existing numbered SQL migrations and evidence artifacts remain unchanged because their filenames are immutable audit identifiers. Legacy local-storage keys are read only long enough to migrate a user's existing browser data to the public-runtime namespace.

Route-specific CSS may define layout and domain semantics. Global color, radius, elevation, contrast, motion, navigation and interaction rules belong in `qelly-product-experience.css`; it loads last to prevent another override stack.
