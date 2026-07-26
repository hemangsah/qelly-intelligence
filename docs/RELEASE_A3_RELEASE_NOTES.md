# Release A3 Release Notes

Release A3 completes the local passkey/recovery/provider foundation while preserving all inherited Qelly routes and safety boundaries.

## Added
- WebAuthn passkey registration, authentication, listing and revocation.
- MFA secret envelope encryption.
- Atomic recovery-code consumption and regeneration.
- S3-compatible storage adapter with AWS Signature V4.
- Signed webhook and HTTP email adapters.
- Provider operations frontend and APIs.
- MinIO production-simulation topology.

## Fixed
- PostgreSQL parity for A2 MFA, secure-import and delivery-attempt repositories.
- Prefixed table-name mismatch in production migrations.

## Deferred
Live cloud services, physical-authenticator CI, KMS, external delivery credentials and penetration testing.
