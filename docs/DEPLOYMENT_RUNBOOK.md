# Deployment Runbook

## Local Docker preview

The root `docker-compose.yml` is intentionally `NODE_ENV=development`. It may emulate PostgreSQL, Redis, MinIO, API, migration, and worker boundaries with local-only values. It is not production evidence.

## Externally hosted preview

Follow `docs/deployment/DEPLOYMENT_DEPENDENCY_MAP.md` in dependency order. Populate `.env.preview.example` only inside encrypted provider secret managers.

1. Provision managed PostgreSQL with a pooled application endpoint and a direct operations endpoint.
2. Run the `Dockerfile.ops` migration job twice, then `npm run migrate -- --status`.
3. Verify the PostgreSQL schema, rollback, isolation, and pooled/direct connection boundaries from an authorized trusted job.
4. Provision TLS Redis and the persistent container host.
5. Provision private S3, then private ClamAV.
6. Configure transactional email, signed webhooks, and their exact HTTPS allowlist.
7. Inject session, password-pepper, keyring, and signing secrets.
8. Start `Dockerfile.worker`, run the full PostgreSQL/Redis integration suite, and require a current `node scripts/worker-health-check.mjs` result.
9. Deploy `Dockerfile` to the persistent container host. Strict startup must succeed.
10. Build and deploy `dist/frontend` with its verified HTTPS API base.
11. Complete `docs/deployment/PREVIEW_VERIFICATION_RUNBOOK.md`.

Migrations never run during API startup or Vercel builds. Vercel receives only static files. Redis consumers, streaming HTTP, schedules, worker jobs, ClamAV, migrations, backup, and restore stay on container infrastructure.

## Rollback

Redeploy the last verified immutable API and worker image. Do not reverse a data migration unless its data semantics and restore path were tested. Preserve audit heads, dead letters, logs, and correlation IDs. Prefer a forward migration. Use the isolated restore procedure in `docs/deployment/BACKUP_RESTORE_RUNBOOK.md`.
