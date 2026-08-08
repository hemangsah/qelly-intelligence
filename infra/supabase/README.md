# Qelly Supabase infrastructure

This subtree source-controls the Supabase artifacts that back Qelly's evidence-first workspace services. It was introduced to reconcile already-deployed production state with the GitHub repository without changing the frontend layout.

## Qelly Verify boundary

Qelly Verify preserves the browser-local raw-data contract defined by the product methodology. Raw CSV text and raw trade rows are not accepted by the governed Verify backend and are not persisted by the Verify assessment tables.

The backend stores only derived evidence reports, browser-computed SHA-256 source fingerprints, report integrity hashes, revision metadata, and workspace ownership metadata. All exposed functions require JWT authentication and use the caller's Supabase identity so database RLS remains authoritative; they do not use a service-role bypass.

Verify runtime v3 strictly reconstructs sealed evidence from an allow-list of expected scalar/aggregate fields instead of copying caller-supplied analysis objects wholesale. Database triggers separately enforce the governed report shape, payload-size limits, current methodology/engine/source versions, browser-local metadata and deterministic sequence-stress contract.

The deterministic local engine currently covers internal historical-sample diagnostics and a seeded 500-permutation trade-order sequence stress. This is not generative Monte Carlo. Out-of-sample validation, true walk-forward validation, parameter-search correction, regime dependency, transaction-cost sensitivity, execution sensitivity, portfolio interaction, and live degradation remain NOT ASSESSED unless separately implemented and validated.

## Layout

- `migrations/20260808_qelly_verify_assessment_persistence_v1.sql` — workspace-scoped Verify assessments, immutable revisions, RLS and raw-data prohibitions.
- `migrations/20260808_qelly_verify_contract_validation_v1.sql` — report/version/fingerprint/browser-local/sequence-stress contract validation.
- `migrations/20260808_qelly_verify_payload_shape_hardening_v1.sql` — strict report shape, payload-size, governed-version and bounded-text-array validation.
- `functions/qelly-verify-runtime/index.ts` — v3 governed sealer for already-derived browser-local Verify analysis using strict field allow-lists.
- `functions/qelly-workspace-api/index.ts` — caller-scoped workspace CRUD; Verify assessments writable and Verify revisions read-only.
- `functions/qelly-workspace-search/index.ts` — RLS-visible workspace search including saved Verify metadata.
- `functions/qelly-account-export/index.ts` — RLS-visible account export including Verify reports/revisions but no raw trade rows.
- `functions/qelly-revision-restore/index.ts` — immutable-history restore including Verify assessments.

## Deployment provenance

Verify runtime source is pinned to Qelly repository revision `c92e6bc36ba5cdb09b4868bfce149e939e25dd9f`, which contains the merged local Verify engine/report/methodology work. The production Supabase security advisor was clean after the deployed changes were applied.

No artifact in this subtree enables brokerage, custody, wallet operations, order execution, guaranteed returns, or personalized trade recommendations.
