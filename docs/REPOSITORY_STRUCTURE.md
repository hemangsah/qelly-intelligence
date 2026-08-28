# Repository structure and naming standard

This repository uses purpose-first locations. Product behavior is owned by `apps/`, `src/`, `functions/`, `packages/` and `runtime/`; platform source is under `supabase/`, `infra/supabase/`, `deploy/` and `config/`; design source is under `design/`; durable state and historical evidence are under `project-state/`, `artifacts/` and `validation/`.

## Canonical locations

- `docs/governance/` — durable architecture, product, provider, licensing, accessibility and writing standards.
- `design/tokens/` — source design-token contracts.
- `design/inventory/` — governed design, route and screen source matrices.
- `design/figma/` — Figma specifications, matrices and the three self-contained generators in `plugins/`.
- `scripts/` — executable repository automation; developer launch/check entrypoints are in `scripts/dev/`.
- `artifacts/` — current machine-readable release inventories and exact source-tree snapshots.
- `project-state/` — historical/audit ledgers. These are append-only evidence and are not rewritten to make old paths look current.

## Naming

- Directories and source files use lowercase kebab-case, except governed documents and machine artifacts whose established `QELLY_`/release identifiers are part of their external contract.
- Workflow files use lowercase purpose names (`ci.yml`, `security.yml`, `browser-e2e.yml`, `cloudflare-preview.yml`, `cloudflare-production.yml`, `production-parity.yml`, `database.yml`, `containers.yml`, `design-governance.yml`, `release.yml`). A workflow display name is title case and describes the permanent purpose, not a prompt, wave, version, corrective branch or date.
- Branches use `<type>/<purpose>-<YYYYMMDD>` for repair/audit work (`repair/repository-systematization-20260828`) and permanent `release/<product-line>` for release branches. Prompt-, v53- and evidence-run branches are historical, not naming templates.
- Environment variables are uppercase `QELLY_` names with words separated by underscores. Secrets never appear in source, examples or artifacts; public configuration uses `QELLY_PUBLIC_*` and explicitly labels publishable values.
- Generated artifacts are written to `artifacts/`, `validation/` or ignored `outputs/` subtrees, include an exact-head field where applicable, and never overwrite a governed source matrix.

## Compatibility and deletion policy

Moves are performed only after repository references, workflow consumers, tests and history are checked. Historical ledgers preserve the paths that existed when they were captured. A file is deleted only when no active consumer, deployment contract or historical-retention requirement remains; otherwise it is moved, renamed or explicitly marked legacy.
