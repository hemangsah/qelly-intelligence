# Release A3 Runbook

## Local development

```bash
cp .env.example .env
npm start
```

Open `http://127.0.0.1:4480`.

## Validation

```bash
npm test
npm run smoke
npm run browser:render
npm run a11y
npm run validate
npm run inventory
npm run release:check
```

## Production simulation

Configure strong values for session, password-pepper, secret-protection, PostgreSQL, Redis and MinIO credentials, then run:

```bash
docker compose up --build
```

Verify `/api/health` and `/api/ready`. Delivery defaults to disabled until an explicit provider is configured.

## Backup/restore

The operations image supports PostgreSQL `pg_dump` and checksum manifests. Use encrypted managed snapshots as well, and prove recovery through the isolated restore procedure in `docs/deployment/BACKUP_RESTORE_RUNBOOK.md`.
