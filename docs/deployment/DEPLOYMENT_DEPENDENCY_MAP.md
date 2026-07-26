# Qelly Deployment Dependency Map

## Workload placement

| Workload or dependency | Placement | Repository entry point | Persistent or stateful | Must not run in an ephemeral function |
|---|---|---|---:|---:|
| Static web frontend | Vercel or an equivalent static CDN | `npm run build:frontend` → `dist/frontend` | No | No |
| Node HTTP API, SSE responses, authenticated downloads | Persistent container host | `Dockerfile`, `npm start` | Yes | Yes |
| Redis queue consumer, retries, schedules, delivery jobs | Persistent container host | `Dockerfile.worker`, `npm run worker` | Yes | Yes |
| Controlled schema migration | Trusted one-shot container job | `Dockerfile.ops`, `npm run migrate` | One shot | Yes |
| Backup and restore operations | Trusted one-shot container job | `Dockerfile.ops`, `npm run backup` / `npm run restore` | One shot | Yes |
| Application records and sessions | Managed PostgreSQL | `DATABASE_URL` | Yes | N/A |
| Migration connection | Managed PostgreSQL direct endpoint | `QELLY_MIGRATION_DATABASE_URL` | Yes | N/A |
| Job signal, delay, lease, heartbeat, and dead-letter state | Managed Redis | `REDIS_URL` | Yes | N/A |
| Quarantine and released imports | Private S3-compatible storage | `S3_*` | Yes | N/A |
| Malware scanning | Private ClamAV TCP service | `CLAMAV_HOST`, `CLAMAV_PORT` | Long running | Yes |
| Registration, recovery, and operational email | Transactional email HTTPS API | `QELLY_EMAIL_*` | External | N/A |
| Signed notification delivery | Explicit HTTPS webhook destinations | `QELLY_WEBHOOK_SIGNING_SECRET`, `QELLY_OUTBOUND_ALLOWED_ORIGINS` | External | N/A |

The frontend artifact contains no Node server, worker, Redis consumer, migration runner, or ClamAV client process. `vercel.json` publishes only `dist/frontend`. The API, worker, and operations jobs have separate Dockerfiles.

## Dependency order

1. Managed PostgreSQL and direct migration endpoint.
2. Controlled migrations and PostgreSQL integration verification.
3. Managed Redis with TLS.
4. Persistent container host for the API, worker, and trusted operations jobs.
5. Private S3-compatible storage.
6. Private ClamAV reachable only from Qelly workloads.
7. Transactional email and its authenticated health endpoint.
8. HTTPS webhook allowlist and signing secret.
9. Session, password-pepper, and 32-byte versioned encryption keys.
10. Start the worker, verify its heartbeat, then start the strict API.
11. Static frontend with its HTTPS API base URL.
12. External end-to-end verification, repository protection, backup, restore, and rollback drills.

The API deliberately fails strict startup until every required dependency is live, migration 106 is present, storage denies anonymous listing, ClamAV answers `PING`, email health succeeds, webhook signing self-verifies, the audit ledger is PostgreSQL-backed, Redis uses TLS, and at least one worker heartbeat is active.

## Region and network requirements

Use one primary region for PostgreSQL, Redis, the API, worker, S3, and ClamAV. For an India-centered preview, `ap-south-1` or the provider's Mumbai equivalent is the default when every selected service supports it. Do not split stateful services across regions merely to use unrelated free tiers.

- PostgreSQL and Redis: private networking when the host supports it; verified TLS in all cases.
- S3: same or adjacent region, private bucket, public access blocks enabled, narrowly scoped credentials.
- ClamAV: same private network as API and worker; never publish TCP 3310 to the internet.
- Frontend: global CDN is appropriate because it is static.
- Email and webhooks: HTTPS only; outbound destinations must appear in the exact origin allowlist.

Billing and free-tier limits are provider- and date-dependent. Confirm sleep behavior, connection limits, storage retention, egress, backups, and whether private networking requires a paid plan before provisioning.

## Exact environment boundary

Use `.env.preview.example` for an externally hosted preview and `.env.production.example` for a final public deployment. Never populate or commit either template. The host secret manager is the source of runtime values.

`DATABASE_URL` is pooled application traffic. `QELLY_MIGRATION_DATABASE_URL` is a direct connection used only by the controlled migration or operations job. Migrations never run during API startup or frontend requests.
