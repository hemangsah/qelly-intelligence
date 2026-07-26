# Part 21 Release Notes and Known Limitations

## Added

- Guided user/tenant/workspace-scoped onboarding
- Notification schedule management and explicit due evaluation
- Replay-safe scheduled in-app notifications
- Sandboxed formula screeners
- Portfolio contribution attribution
- CSV import templates, preview and audited staging
- Research version capture, diff and restore
- PostgreSQL-oriented migration contracts and migration-status APIs
- Seven new responsive frontend routes
- Five new runtime request schemas
- One new machine-readable capability contract

## Corrected during release hardening

1. Import commits previously used a generic read permission. They now require watchlist, portfolio or research write permission according to import kind.
2. Research restore audit mutation previously occurred before the idempotency boundary. Audit and restore now execute together only for the first accepted mutation.
3. Scheduled notification replay was verified to avoid duplicate notification creation.

## Known limitations

- Notification schedules do not run autonomously; the local due-evaluation endpoint must be called.
- Only in-app deterministic notifications are created. Email, SMS, push and webhooks are disabled.
- Formula syntax is intentionally small and is not a general programming language.
- Portfolio attribution uses fixture holdings and locally derived returns; it is not accounting-grade or broker-reconciled.
- CSV parsing is deliberately bounded and does not support arbitrary encodings, quoted multiline fields, files or large production batches.
- Import commits stage local records only and do not apply them to watchlists, portfolios or research systems.
- Research history is single-host JSON persistence without collaborative merges or distributed durability.
- SQL files are architecture contracts, not a complete production schema or executable migration program.
- No production database connection, migration runner, backup service, restore automation or replication exists.
- Production identity, external providers, licensed data, collaboration, broker connections and financial execution remain disabled.
