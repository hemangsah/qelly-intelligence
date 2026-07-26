# Wave 2 Identity and Security Foundation

**Current status:** local foundation implemented; production authentication gated.

Implemented locally:

- Organization/workspace/session/device/membership context.
- Deny-by-default tenant-aware RBAC + ABAC.
- Resource boundary checks and high-assurance obligations.
- Session/device inventory, revocation and workspace switching.
- Explicitly simulated ten-minute step-up assurance.
- Purpose-specific consent records and privacy inventory.
- CSRF proof, request limits, rate limiting, secure headers, correlation IDs and idempotency.
- Append-only hash-chained audit verification.

Deferred production capabilities include WebAuthn ceremonies, email links, OIDC callbacks, enterprise SSO, account recovery, suspicious-login detection, production cookies, service accounts, API tokens, JIT access, delegation and break-glass operations.
