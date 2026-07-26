# Release A4 Runbook

## Local development
1. Copy `.env.example` to `.env`.
2. Keep dangerous financial flags false.
3. Run `npm test`, `npm run smoke`, and `npm start`.
4. Open `http://127.0.0.1:4480`.

## Production simulation
Use Docker Compose with PostgreSQL, Redis and MinIO. Configure an explicit outbound origin allowlist. Do not enable external delivery until endpoints and signing policies are verified.

## Recovery
Use the backup and restore scripts with checksum verification. Recovery resets revoke existing sessions.
