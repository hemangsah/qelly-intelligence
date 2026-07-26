# Qelly Deployment Status

## Current deployability

**Preview deployable**

The repository has separate static frontend, persistent API, persistent worker, and trusted operations artifacts. Production startup is strict and live-probed. No externally reachable preview URL is claimed until provider resources are provisioned and verified.

## Repository-side deployment baseline

- 61 application routes and 187 documented API contracts
- PostgreSQL pooled application client and direct controlled migrator
- checksum history, advisory migration lock, repeated-run safety, and one transaction per migration
- migrations through `106_deployment_runtime_state.sql`
- PostgreSQL identity, sessions, organizations, workspaces, portfolio metadata, watchlists, alerts, audit chain, and Decision Provenance persistence
- TLS Redis, delayed jobs, exponential retry, dead letters, duplicate suppression, leases, restart recovery, heartbeat, and graceful worker shutdown
- private S3 live probe, anonymous-list denial, quarantine/released prefixes, short-lived signed downloads, and deletion
- live ClamAV `PING` readiness and fail-closed release
- authenticated email health, exact-body webhook HMAC, timestamps, delivery IDs, replay policy, HTTPS allowlist, and SSRF defense
- exact 32-byte keyring validation and recursive structured-log redaction
- fail-closed strict API startup and deep `/api/ready`
- Vercel static output at `dist/frontend`; no persistent workload is assigned to an ephemeral function
- PostgreSQL `pg_dump`/`pg_restore` operations with checksum manifests and explicit restore confirmation

## External dependency state

Managed PostgreSQL is the first unresolved dependency. Redis, persistent containers, S3, ClamAV, email, webhooks, secrets, frontend deployment, external verification, branch protection, and backup/restore evidence follow in that order.
