# Production Database Migration Contract

## Purpose

Part 21 documents a migration path from single-host JSON/NDJSON persistence to a production-oriented PostgreSQL foundation. The included SQL files are contracts for review and are never executed by the packaged runtime.

## Proposed phases

1. **Foundation** — identities, organizations, workspaces, memberships, sessions and audit metadata.
2. **Workspace state** — preferences, watchlists, alert rules, notifications, screeners, research workspaces, schedules, onboarding and imports.
3. **Market data separation** — move time series, stream journals and high-volume observations to an appropriate time-series or analytical store.
4. **Cutover** — dual-write verification, reconciliation, backup, restore rehearsal, staged traffic and rollback capability.

## Mandatory gates before execution

- Approved production schema and data-retention policy
- Production identity and service-to-service authentication
- Managed secrets and encryption keys
- Tested database migrations and rollback scripts
- Point-in-time recovery and restore rehearsal
- Data reconciliation and checksum reports
- Capacity, load, failure and concurrency testing
- Data residency and privacy review
- Monitoring, alerting, incident response and owner assignment
- Independent security review

## Explicitly absent

- Database connection string
- Migration runner
- Production credentials
- Automated schema execution
- Data backfill job
- Dual-write implementation
- Production cutover
- Backup or restore automation
- Replication or failover

Environment flags `QELLY_PRODUCTION_DATABASE_ENABLED` and `QELLY_MIGRATION_EXECUTION_ENABLED` remain `false` and are verified by the release gate.
