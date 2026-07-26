# Release A3 Security Report

## Implemented controls

- WebAuthn challenge, RP ID, origin, user-presence, signature and counter verification.
- AES-256-GCM protected MFA secret envelopes.
- Hashed, atomic, single-use recovery codes.
- Signed HttpOnly cookie sessions and session-derived CSRF.
- Tenant/workspace authorization, idempotency and audit retained.
- AWS Signature V4 S3 request signing.
- HMAC-SHA256 webhook signing.
- Explicit production refusal for unsafe local provider fallbacks.

## Deferred controls

- Cloud KMS/HSM key lifecycle and rotation.
- Independent WebAuthn interoperability certification.
- Full malware-scanning service and quarantine pipeline.
- SSRF allowlist for arbitrary external webhooks in a cloud network.
- Independent penetration test and OWASP ASVS assessment.

## Safety

No live trading, custody, transfer, withdrawal, private-key or recovery-phrase capability is enabled.
