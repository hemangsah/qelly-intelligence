# PostgreSQL Backup and Restore Runbook

The inherited `npm run backup` utility covers the SQLite development adapter only. Production PostgreSQL must use encrypted managed snapshots plus `pg_dump`/`pg_restore` evidence.

## Backup

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > qelly-$(date -u +%Y%m%dT%H%M%SZ).dump
sha256sum qelly-*.dump > qelly-backup.sha256
```

Store the dump and checksum in encrypted, access-controlled backup storage. Record the PostgreSQL version, migration version, application commit, and timestamp.

## Restore drill

1. Provision an isolated PostgreSQL database.
2. Verify the checksum.
3. Restore with `pg_restore --clean --if-exists --no-owner --no-acl`.
4. Run migrations in validation mode.
5. Execute authentication, tenant isolation, portfolios, watchlists, alerts, audit verification, Decision Provenance creation/traversal/export, and readiness checks.
6. Destroy the drill environment after recording evidence.

Never test a destructive restore against the live production database.
