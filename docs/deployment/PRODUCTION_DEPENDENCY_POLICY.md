# Production Dependency Policy

Strict preview and production start only with:

- pooled PostgreSQL on verified TLS at migration 106;
- a separate direct migration URL used by a controlled job;
- TLS Redis with an active persistent worker heartbeat;
- a private S3-compatible bucket that rejects anonymous listing;
- live private ClamAV responding to a TCP `PING`;
- an authenticated transactional-email health endpoint;
- configured exact-body HMAC-SHA256 webhooks with timestamp, delivery ID, and replay controls;
- a valid versioned 32-byte encryption keyring;
- PostgreSQL-backed runtime state, portfolio metadata, Decision Provenance, and hash-chained audit records;
- production cookie identity with only explicit HTTPS frontend/WebAuthn origins.

`/api/health` is process liveness. `/api/ready` is the dependency and policy gate. The API exits before listening when strict readiness is false. Migrations are never an API startup side effect.

Development and test may use SQLite, a database queue, local files, deterministic scanning, and a local delivery sink. The production environment validator rejects those modes and every legacy override that would permit them.
