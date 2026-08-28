# Qelly frontend architecture

## Current runtime

The frontend is a dependency-light ES-module application served from `apps/web/public`. The standalone build copies it to `dist/frontend` and adds shared runtime packages for accessibility, UI primitives, data grid, and chart shell. The same source supports:

- production API mode through `QELLY_PUBLIC_API_BASE_URL`;
- same-origin server mode;
- a compile-time GitHub Pages **Static visual preview** mode.

## Governed shell

- `route-registry.mjs` is the executable route source and now assigns `domain` and `kind`.
- `shell-foundations.mjs` renders the edge dock, persona ribbon, breadcrumbs, category shelf, mobile navigator, and persistent intelligence actions.
- `persona-profiles.mjs` governs density, horizon, motion, alert posture, terminology, module priority, and safe defaults.
- `primitives.mjs` owns reusable truth-state and source-disclosure markup.
- `qelly-foundations.css` is the final composition layer. It consumes canonical token aliases without replacing the existing route styles.

## Route migration rule

Existing route modules remain executable. Migration is incremental:

1. assign route domain and shell kind;
2. replace ad hoc status markup with governed primitives;
3. move route-specific inline styles into a named pattern;
4. implement route-owned loading, empty, partial, stale, fallback, permission, and offline states;
5. add source requirements and completion criteria to the route inventory;
6. add responsive and keyboard tests;
7. split large route modules only when the bundle/performance evidence justifies it.

This avoids a risky rewrite and prevents demo logic from leaking into production.

## Static preview boundary

`QELLY_STATIC_VISUAL_PREVIEW=true`:

- configures no API origin;
- uses deterministic read-only demo records;
- rejects all mutations;
- labels backend, persistence, providers, authentication, and workers unavailable;
- supports the repository base path and direct-navigation hash fallback;
- includes no production secret or private endpoint.

Production mode continues to use credentialed requests, CSRF, authentication policy, and configured API origins.

## Performance direction

Later batches should introduce route-based code splitting, table virtualization, cancellable requests, and measured route budgets. The present batch does not claim those are complete; it preserves the current production contracts while creating the architecture and inventory needed to migrate safely.
