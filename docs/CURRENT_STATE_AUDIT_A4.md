# Current State Audit - Release A4

## Baseline

The latest runnable engineering baseline was Release A3, not the later large-screen design atlases. A4 preserves A3 and adds account recovery, outbound-network controls, secure-import quarantine and platform-readiness evidence.

## Current verified inventory

- Release: 26.0.0
- Frontend routes: 57
- API route contracts: 165
- Machine-readable contracts: 16
- Runtime JSON schemas: 58
- Automated tests: 228
- Smoke requests: 237
- All-screen renders: 114
- Focused accessibility/responsive checks: 30

## Storage and workers

SQLite remains the runnable local/test store. PostgreSQL, Redis and S3-compatible adapters and migrations are present. Persistent jobs, retries, dead-letter state, local object storage, backup and restore tooling remain available.

## Truth classification

Implemented local: account recovery, quarantine, outbound SSRF policy, platform readiness, identity/session/MFA/passkey foundations, jobs, notification attempts and local object storage.

Partial or deployment-dependent: cloud PostgreSQL/Redis/MinIO execution, KMS/HSM, full malware scanning, external delivery sandboxes, staging deployment and independent security testing.

Disabled for safety: live trading, custody, transfers, withdrawals, private keys and recovery phrases.
