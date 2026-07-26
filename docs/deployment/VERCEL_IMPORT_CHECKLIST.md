# Qelly Intelligence — Vercel Import Checklist

## Architecture decision

The inherited application is a long-running Node HTTP server plus a separate worker. Vercel can host static frontend assets and short-lived request handlers only after a focused serverless adapter is added. The worker, Redis queue consumer, ClamAV TCP scanner, and persistent streaming workloads must run on Railway, Render, Fly.io, or an equivalent container host.

This repository is **not yet represented as deployed on Vercel**. `vercel.json` records the intended build constraints and security headers; it deliberately does not declare an API function until a real serverless adapter exists.

## Import settings

- Repository: `hemangsah/qelly-intelligence`
- Framework preset: Other
- Root directory: repository root
- Node.js: 22.x
- Install command: `npm ci --ignore-scripts`
- Build command: `npm run build`
- Output directory: none for the API service; `dist/apps/web/public` may be used for static review assets only
- Production migration command: run `npm run migrate` from a protected deployment job before traffic is switched
- Health endpoint: `/api/health`
- Readiness endpoint: `/api/ready`

## Required services

- Managed PostgreSQL: Neon, Supabase, or another PostgreSQL provider
- Serverless-compatible Redis: Upstash Redis or equivalent
- Private S3-compatible object storage
- Container-hosted ClamAV service
- Transactional email provider reachable through the configured HTTPS adapter
- Signed-webhook destinations on explicit HTTPS allowlists
- Managed platform secrets or KMS-backed secret injection
- Separate persistent worker deployment using `npm run worker`

## Required production environment

Run `NODE_ENV=production npm run env:check` before deployment. The validator requires PostgreSQL, Redis, S3, ClamAV, external delivery providers, WebAuthn origins, an encryption keyring, and disabled financial-risk features. No production fallback to SQLite, local JSON evidence persistence, database queues, local object storage, the foundation scanner, local email, or local webhooks is permitted.

## Deployment-time migration safety

1. Create an encrypted managed snapshot.
2. Run `npm run migrate` exactly once in a protected job.
3. Run migration validation and `/api/ready` against the new version.
4. Do not route traffic if readiness is non-200.
5. Roll back application traffic before database rollback; use a documented forward-fix whenever a destructive rollback would risk data loss.

## Function and worker boundaries

- API request timeout target: 30 seconds maximum.
- Background jobs, retries, delayed work, ClamAV scanning, WebSocket streams, and queue consumers must not run inside ephemeral Vercel request functions.
- Deploy `apps/worker/worker.mjs` on a persistent container service.
- Long-lived market streaming should use a container service or managed event infrastructure.
