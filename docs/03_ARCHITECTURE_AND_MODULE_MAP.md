# Architecture and Module Map

## Frontend

- `apps/web/public/index.html` — application shell
- `apps/web/public/assets/app.js` — legacy application coordinator and inherited renderers
- `apps/web/public/assets/route-registry.mjs` — central navigation/route registry
- `apps/web/public/assets/routes/asset-intelligence.mjs` — first independently packaged feature renderer
- `packages/ui-primitives`, `data-grid`, `charting`, `accessibility` — reusable browser modules

The frontend is only partially modularized. Remaining inherited route renderers should be extracted incrementally.

## Backend

- `src/server/server.mjs` — HTTP/BFF dispatch and security boundary
- `src/server/runtime.mjs` — service construction/composition root
- `src/server/route-manifest.mjs` — release, UI and API contract registry
- `src/validation/schema-validator.mjs` — local JSON Schema subset enforcement
- `src/platform/json-store.mjs` and `local-file-lock.mjs` — single-host atomic persistence
- `src/security/audit-ledger.mjs` — recursive hash chain and checkpoint
- `src/asset-intelligence/asset-intelligence-service.mjs` — Wave 6 local domain

Inherited identity, providers, entitlements, instruments, time series, streaming, observability and discovery services remain intact.

## Production migration boundary

Replace local JSON/NDJSON stores with database repositories, local locks with database/distributed transactions, fixture identity with an external identity provider, in-memory CSRF/session state with production session infrastructure, the schema subset with a maintained production validator, and deterministic data services with licensed adapters and ingestion pipelines.
