# Production Database Migration Contract

## Implemented execution boundary

`npm run migrate` is a controlled PostgreSQL operations command. In production it requires `QELLY_MIGRATION_DATABASE_URL`, obtains a stable advisory lock, verifies immutable SHA-256 migration checksums, and applies each pending migration and its history record in one transaction. A failure rolls back that migration. Repeated execution is safe. `--status`, `--check`, and `--dry-run` are read-only and do not create the migration-history table.

`npm run migrate -- --status` and `--check` report applied and pending migrations without applying pending SQL. API startup and frontend builds never invoke the migrator.

## Current schema

Migrations 100–106 cover production identity, sessions, jobs, notifications, MFA, imports, delivery attempts, passkeys, recovery, Decision Provenance graphs/nodes/edges/exports, runtime JSONB state, portfolio metadata, and durable audit records.

The Part 21 contract tables in 001 and 002 remain for compatibility with prior migration history. Production runtime code uses the `qelly_*` tables introduced and extended by migrations 100–106.

## Mandatory deployment gates

- direct migration endpoint and pooled application endpoint;
- verified TLS and least-privilege provider credentials;
- backup or managed snapshot before change;
- checksum and advisory-lock verification;
- repeated migration and status verification;
- authentication, sessions, organization/workspace, portfolio, watchlist, alert, audit, and Decision Provenance tests;
- tenant/workspace isolation, concurrency, rollback, backup, and isolated restore;
- `/api/ready` reporting migration 106.
