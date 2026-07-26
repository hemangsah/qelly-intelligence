# Qelly Intelligence Current-State Audit

Generated: 2026-07-25T09:15:18.306994Z

## Baseline decision

The latest runnable engineering baseline is **Qelly Intelligence Part 22 Sovereign Live Markets Experience**, SHA-256 `d84c33086438e6e4115051ef15c9ca8f4b6847c5832b4f350d2b3508dd3e4156`. The later 400-screen and 10,000-screen packages are design atlases and route taxonomies, not evidence of implemented production workflows.

The next unambiguous engineering release is **Release A1 / version 23.0.0**.

## Inherited baseline inventory

- Frontend routes: 47 before A1
- API route contracts: 134 before A1
- Backend: Node.js modular local runtime
- Persistence: local atomic JSON/NDJSON plus deterministic fixtures
- Identity: local simulated identity with production isolation
- Providers: deterministic providers plus optional public read-only Binance/CoinDCX market adapters
- Security: RBAC/ABAC foundation, session-bound CSRF, idempotency, schema validation, recursive tamper-evident audit
- Design: locked Qelly gradient, six operating personas, hybrid static/dynamic interaction model
- Financial execution: disabled

## Baseline defect found and fixed

The inherited suite initially had one time-dependent failure: the packaged fixture session had expired, causing a public live-market regression test to receive HTTP 403. The fix renews an expired fixture session only while explicit local simulated identity is enabled. It does not allow fixture identity in production mode.

## Release A1 additions

- Production-style registration, password login, logout and session rotation
- Signed HttpOnly cookie sessions and session-derived CSRF
- scrypt password hashing with salt and optional pepper
- Transactional user, organization, workspace, membership, session, job and notification persistence
- PostgreSQL repository and migration contract
- SQLite development/test adapter with production guard
- Redis-signaled persistent job queue contract and database development queue
- Worker process and replay-safe in-app notification job
- Health/readiness endpoints
- Migration and seed runners
- Login, registration and account-session frontend routes
- Docker Compose topology for PostgreSQL, Redis, migration, API and worker

## Truthful production status

This release is a **production-platform foundation**, not a completed production deployment. All behavior was executed locally with SQLite and the database-backed queue. PostgreSQL and Redis implementations are packaged, but a live Docker/PostgreSQL/Redis environment was not available in this workspace. Their status is therefore `partial-contract` until deployment integration tests run.

The inherited local JSON domain stores remain in place and require incremental migrations. Passkeys, MFA, recovery, external notifications, object storage, production secrets/KMS, licensed providers and cloud deployment are not complete.

Live trading, custody, transfers, withdrawals, private keys and recovery phrases remain disabled.

## Current counts

- Frontend routes: 50
- API route contracts: 144
- Machine-readable contracts: 13
- JSON schemas: 49
- Automated tests: 207
- Full-stack smoke requests: 222
- Changed-route browser renders: 8
- Accessibility/responsive checks: 16

See `data/RELEASE_A1_CAPABILITY_MATRIX.csv` for item-level classification.
