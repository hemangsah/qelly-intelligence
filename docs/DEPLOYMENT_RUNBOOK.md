# Deployment Runbook

## Local Docker preview

The root `docker-compose.yml` is intentionally a `NODE_ENV=development` preview topology. It exercises PostgreSQL, Redis, S3-compatible storage, API, migration, and worker boundaries with local-only credentials and the deterministic malware scanner. It must not be presented as a production deployment.

## Portable container deployment

1. Provision PostgreSQL, Redis and S3-compatible storage.
2. Copy `.env.example` into the host's secret/environment manager and replace every placeholder.
3. Keep all financial-execution safety flags `false`.
4. Run `NODE_ENV=production npm run env:check`.
5. Run `npm ci --ignore-scripts && npm run check`.
6. Run `npm run migrate`.
7. Start the API with `npm run start:production` and the worker with `npm run worker`.
8. Verify `/api/health`, `/api/ready` and `/api/v1/public/markets/overview`.
9. Run authenticated registration/login and tenant-isolation smoke tests.
10. Enable external public providers only after reviewing their terms and rate limits.

## Rollback

Redeploy the previously verified image. Do not roll back a destructive migration without a tested reverse migration. Restore the latest checksum-verified backup when data recovery is required, then re-run readiness and critical-journey checks.

## Current account-side action

The source repository is `hemangsah/qelly-intelligence`. Managed-service provisioning, production secret entry, domain control, billing approval, and the final container/Vercel deployment still require the user's authenticated provider accounts.
