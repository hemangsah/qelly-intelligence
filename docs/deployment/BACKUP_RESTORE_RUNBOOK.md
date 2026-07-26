# PostgreSQL Backup and Restore

Use provider-managed encrypted snapshots and the repository operations image. A successful backup is not a successful restore drill.

## Backup

Inject `QELLY_DATABASE_MODE=postgres` and `QELLY_BACKUP_DATABASE_URL` into a trusted `Dockerfile.ops` job, mount an encrypted destination, then run:

```bash
npm run backup -- /secure-backups/qelly-<timestamp>
```

The script uses `pg_dump --format=custom --compress=9 --no-owner --no-acl`, writes a SHA-256 manifest, records the migration and optional release commit, refuses to overwrite an existing dump, and never prints the connection URL.

## Isolated restore drill

Provision an empty isolated PostgreSQL target. Inject its direct URL only as `QELLY_RESTORE_DATABASE_URL`, then run:

```bash
QELLY_RESTORE_CONFIRM=RESTORE_QELLY_DATABASE npm run restore -- /secure-backups/qelly-<timestamp>
```

The script verifies the checksum before `pg_restore`, uses one transaction, exits on the first error, removes ownership/ACL coupling, and requires the explicit confirmation phrase.

After restore, run migration status, authentication, sessions, organizations, workspaces, portfolios, watchlists, alerts, audit integrity, Decision Provenance create/traverse/export, tenant/workspace isolation, concurrency, rollback, queue, and `/api/ready` checks. Record timings and evidence, then destroy the isolated target.

Never point `QELLY_RESTORE_DATABASE_URL` at the live database. Prefer forward fixes over destructive reverse migrations.
