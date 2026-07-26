# ADR-025: Passkeys, protected MFA secrets, object storage and signed delivery

## Status
Accepted for Release A3 local production foundation.

## Decisions

- Use WebAuthn resident/public-key credentials with ES256 and none attestation for the first implementation.
- Persist challenges with expiry and single-use consumption.
- Issue normal Qelly cookie sessions after verified passkey authentication.
- Protect TOTP secrets with AES-256-GCM envelope encryption and require an explicit production key.
- Store recovery-code hashes only; consume atomically.
- Keep object storage behind an adapter with local development and S3-compatible AWS Signature V4 modes.
- Keep delivery behind adapters: disabled, local evidence sink, signed webhook, and explicit HTTP email provider.
- Production startup must not silently fall back to local storage or local delivery.

## Consequences

The platform gains deployable contracts without embedding credentials. Hardware authenticator, live S3/MinIO, SMTP/provider and KMS integration remain deployment validation work.
