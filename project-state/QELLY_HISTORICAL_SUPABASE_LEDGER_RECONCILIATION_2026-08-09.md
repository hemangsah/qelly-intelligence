# Qelly historical Supabase ledger reconciliation — 2026-08-09

## Purpose

This record backfills source control for five migrations that were already present in the production Supabase migration ledger but absent from the repository. It is a source-history reconciliation only. No production DDL is authorized or required by this backfill.

Production project: `ssdgfgqnjlwzkgukzeef`
Baseline main used for recovery: `7c92d4c1d59f57417ec01b67f0ecb39a14675ee7`
Tracking issue: #93

## Recovery method

The original editable files were not recoverable from surviving repository branches or the available conversation/library corpus. Recovery therefore used production read-only evidence:

1. `supabase_migrations.schema_migrations` for exact live versions/names.
2. `extensions.pg_stat_statements` for retained original `CREATE TABLE`, grant/revoke, and `ALTER TABLE` statements.
3. `pg_class` OID creation order to separate the five migration waves from later hardening/index migrations.
4. `pg_get_functiondef`, `pg_get_indexdef`, `pg_get_triggerdef`, and `pg_policy`/`pg_get_expr` for current definitions belonging to the original OID clusters.
5. `information_schema.role_table_grants` for the effective browser/service access boundary.

The backfilled files intentionally use the exact live migration versions. Supabase production already records those versions, so normal migration reconciliation will skip them there. They are executable for a fresh environment but MUST NOT be manually replayed against current production.

## Recovered waves

### 20260808084412 — `qelly_intelligence_workspace_persistence_v1`

Recovered objects include research projects/evidence/revisions, decisions, provenance nodes/edges, watchlists/items, alert rules, the workspace/owner reassignment guard, original RLS policies, triggers, grants and custom indexes.

### 20260808084642 — `qelly_workspace_intelligence_persistence_wave_2`

Recovered objects include decision revisions, portfolios/positions, import jobs, saved views, workspace comments, review requests, research/decision revision functions and triggers, RLS, grants and indexes. This wave also restores the original `qelly_decisions.current_revision` addition.

### 20260808085124 — `qelly_provider_data_runtime_foundation_v1`

Recovered objects include provider registry/readiness/incidents, instrument registry/mappings, time-series series/points and data-quality events. The server-only provider/data tables retain explicit browser-deny RLS; authenticated browser access remains limited to active instrument reads.

### 20260808085300 — `qelly_alert_delivery_observability_dashboard_v1`

Recovered objects include alert events, notification deliveries, runtime jobs, release identity, dashboard layouts/revisions, dashboard revision functions, RLS, grants and indexes. Runtime/release tables remain browser-denied.

### 20260808091443 — `qelly_theme_intelligence_persistence_v1`

Recovered objects include Theme Intelligence presets/revisions/schedules, all 13 retained theme families, six personas, Aggressive Alpha levels/packs, revision functions, RLS, grants, triggers and indexes.

## Separation from later production hardening

These backfills deliberately exclude later FK covering indexes and trigger-helper hardening. Those remain source-controlled separately through the reconciliation merged in PR #95:

- `20260808160502_qelly_trigger_helper_execute_hardening_v1.sql`
- `20260808160525_qelly_fk_covering_indexes_v1.sql`
- `20260808160635_qelly_fk_covering_indexes_duplicate_cleanup_v1.sql`

The already-reconciled Qelly Verify persistence migration remains separate as well.

## Production safety statement

No `apply_migration`, migration replay, table mutation, policy mutation, trigger mutation, or Edge Function deployment was performed while recovering these files. All Supabase operations used for this reconciliation were read-only inspection queries.
