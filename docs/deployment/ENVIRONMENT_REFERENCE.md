# Deployment Environment Reference

Never commit values. Inject them through the deployment platform's encrypted secret manager.

## Templates

- Local development: `.env.example`
- Externally hosted preview: `.env.preview.example`
- Public production: `.env.production.example`

## PostgreSQL

- `DATABASE_URL`: pooled application URL, PostgreSQL protocol, verified TLS.
- `QELLY_MIGRATION_DATABASE_URL`: direct URL for trusted operations jobs only.
- `QELLY_POSTGRES_POOL_MIN`, `QELLY_POSTGRES_POOL_MAX`
- `QELLY_POSTGRES_CONNECT_TIMEOUT_MS`, `QELLY_POSTGRES_STATEMENT_TIMEOUT_MS`, `QELLY_POSTGRES_QUERY_TIMEOUT_MS`
- `QELLY_POSTGRES_IDLE_TIMEOUT_MS`, `QELLY_POSTGRES_MAX_LIFETIME_SECONDS`
- `QELLY_POSTGRES_TLS_CA_BASE64`, `QELLY_POSTGRES_TLS_REJECT_UNAUTHORIZED`
- `QELLY_MIGRATION_LOCK_TIMEOUT_MS`, `QELLY_MIGRATION_STATEMENT_TIMEOUT_MS`

## Redis and worker

- `REDIS_URL`: must use `rediss://`.
- `QELLY_REDIS_TLS_CA_BASE64`, `QELLY_REDIS_TLS_REJECT_UNAUTHORIZED`, optional `QELLY_REDIS_TLS_SERVERNAME`
- `QELLY_REDIS_CONNECT_TIMEOUT_MS`, `QELLY_REDIS_COMMAND_TIMEOUT_MS`
- `QELLY_WORKER_ID`, `QELLY_WORKER_LEASE_MS`, `QELLY_WORKER_HEARTBEAT_MS`, `QELLY_WORKER_RECOVERY_MS`

## Storage and scanner

- `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PATH_STYLE`
- `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`

## Delivery and network

- `QELLY_EMAIL_API_URL`, `QELLY_EMAIL_HEALTH_URL`, `QELLY_EMAIL_API_TOKEN`
- `QELLY_WEBHOOK_SIGNING_SECRET`
- `QELLY_OUTBOUND_ALLOWED_ORIGINS`
- `QELLY_FRONTEND_ORIGINS`

## Identity and encryption

- `QELLY_SESSION_SECRET`
- `QELLY_SESSION_COOKIE_SAME_SITE=None` with secure production cookies
- `QELLY_PASSWORD_PEPPER`
- `QELLY_SECRET_KEYRING_JSON`: every value is exactly 32 bytes represented by 64 hex characters, base64, or base64url
- `QELLY_SECRET_ACTIVE_KEY_ID`
- `QELLY_WEBAUTHN_RP_ID`, `QELLY_WEBAUTHN_ORIGINS`

## Frontend build

- `QELLY_PUBLIC_API_BASE_URL`: HTTPS API origin embedded into `qelly-config.js` by `npm run build:frontend`

The validator rejects local production fallbacks, plaintext PostgreSQL or Redis, HTTP storage/delivery endpoints, placeholder secrets, weak key material, missing frontend origins, or enabled trading/custody features.
