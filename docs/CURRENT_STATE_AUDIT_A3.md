# Qelly Intelligence Release A3 - Current-State Audit

Generated: 2026-07-25T11:25:26.474718Z

## Engineering baseline

Release A2 (24.0.0) was the latest verified runnable baseline. The large 400-screen and 10,000-screen outputs are retained as design taxonomy, not treated as implemented workflows. Release A3 continues the real source repository without restarting it.

## Inherited state

- 52 runnable routes and 151 API contracts at A2.
- 211 inherited automated tests were green before A3 changes.
- Production-style cookie identity, tenant persistence, jobs, MFA, secure imports, delivery records and safety locks were preserved.

## Defects and gaps addressed

1. A2 PostgreSQL repository did not implement the full A2 MFA/import/delivery method surface.
2. A2 migration names were inconsistent with the PostgreSQL repository prefix.
3. MFA secrets were not envelope-encrypted.
4. Recovery codes could be generated but not consumed or regenerated through governed APIs.
5. Passkeys were a partial contract only.
6. Object storage had no S3-compatible signing adapter.
7. Delivery adapters had no signed external-webhook contract.

## Release A3 result

- 55 frontend routes.
- 161 API contracts.
- 15 machine-readable contracts.
- 56 JSON schemas.
- Local WebAuthn ES256 registration and authentication.
- AES-256-GCM MFA secret protection.
- Atomic recovery-code consumption and TOTP-gated regeneration.
- PostgreSQL repository parity and A3 migration.
- S3-compatible AWS Signature V4 adapter.
- HMAC-SHA256 webhook adapter and generic HTTP email adapter.
- Provider/storage/delivery operations UI.

## Truth boundary

The executable validation environment uses SQLite and local/in-process test doubles. PostgreSQL, Redis, MinIO/S3, cloud KMS, real email and external webhook endpoints were unavailable. Their adapters and contracts are implemented and tested at unit/contract level, but live service execution is not claimed. Physical authenticator automation was not available; WebAuthn cryptography is tested with generated ES256 credentials.

Live trading, custody, transfers, withdrawals, private keys and recovery phrases remain disabled.
