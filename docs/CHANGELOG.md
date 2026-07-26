# Release A5 — Platform Hardening and Staging Readiness

- Added versioned keyring secret protection and governed rewrap.
- Added quarantine review and assurance workflows.
- Added 3 routes and 10 API contracts.
- 237 tests, 248 smoke requests, 120 browser renders, and 36 accessibility checks passed.

# Changelog

## 25.0.0 - Release A3 Passkeys, Recovery, Storage and Delivery

### Added
- Local production-compatible WebAuthn ES256 registration and authentication.
- Passkey inventory and revocation.
- AES-256-GCM protection for MFA secrets.
- Recovery-code consumption and regeneration.
- S3-compatible AWS Signature V4 object-storage adapter.
- HMAC-signed webhook and generic HTTP email adapters.
- Passkey Center, Account Recovery Controls and Delivery Operations routes.
- MinIO Docker Compose service and bucket initializer.

### Fixed
- PostgreSQL repository parity for A2 records.
- A2/A3 production migration table naming.

### Safety
- Live trading, custody, transfers, withdrawals, private keys and recovery phrases remain disabled.

## 24.0.0 - Release A2 Identity, Import and Delivery Foundation
- TOTP MFA, recovery-code generation, secure local object storage, delivery jobs and backup/restore.

## 23.0.0 - Release A1 Production Platform Foundation
- Production-style identity, tenant persistence, jobs, worker, health/readiness and deployment topology.
