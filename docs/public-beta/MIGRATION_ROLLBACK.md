# Public Beta Migration and Rollback Structure

## Migration rules

- Every schema or persistence change receives a monotonic migration identifier.
- Migrations must be idempotent or explicitly guarded against re-entry.
- Forward and rollback behavior must be documented before staging.
- Provider configuration changes are versioned separately from application schema.
- Feature activation occurs through governed flags, never by hidden source edits.
- No production secret may be committed to the repository or review artifact.

## Release procedure

1. Verify exact source SHA and dependency lock.
2. Validate runtime configuration for the target environment.
3. Apply backward-compatible migrations.
4. Run read-only health and contract probes.
5. Enable canary flags for approved routes/providers.
6. Verify observability, error budget and data-truth labels.
7. Promote only after release gates pass.

## Rollback procedure

1. Disable affected provider or route through the governed kill switch/feature flag.
2. Restore the last verified application artifact.
3. Execute the documented rollback migration only when data safety is proven.
4. Preserve audit logs, lineage and failure evidence.
5. Mark affected values stale, unavailable or partial; never silently substitute fixtures.
6. Record incident, recovery commit, operator and verification evidence in the durable handoff.

## Current state

No database migration, connected provider migration or production release is introduced by this bootstrap PR. The structure is implemented deterministically; operational migrations remain planned.
