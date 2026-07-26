# Qelly Intelligence Release A2 Current-State Audit

## Baseline
Release A1 (23.0.0) was the latest runnable engineering baseline. Later 400/10,000-screen outputs are design taxonomies, not implemented workflows.

## A2 implemented-local
- TOTP enrollment, confirmation, disable and ten recovery codes.
- Tenant-scoped content-addressed local object storage with 10 MB limit, SHA-256 evidence and EICAR signature rejection.
- Persistent secure-import metadata.
- Persistent email/webhook delivery-attempt evidence through local sinks.
- Worker support for delivery jobs with retry/dead-letter behavior inherited from A1.
- SQLite backup/restore with checksums.
- PostgreSQL migration contract for MFA, secure imports and delivery attempts.
- Two responsive routes: MFA & Recovery and Secure Import Vault.

## Partial or blocked
- Passkeys/WebAuthn: partial contract.
- MFA secret encryption with external KMS: partial contract.
- S3/MinIO production object storage: partial contract.
- External SMTP/webhook providers: blocked by credentials and deployment policy.
- Live PostgreSQL/Redis integration: packaged but not executed in this environment.

## Disabled for safety
Live trading, custody, transfers, withdrawals, private keys and recovery phrases.
