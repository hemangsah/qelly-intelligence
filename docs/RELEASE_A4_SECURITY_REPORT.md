# Release A4 Security Report

## Implemented
- Non-enumerating recovery request responses.
- Expiring hashed challenges with single-use consumption and attempt limits.
- Password replacement and complete session revocation.
- Audited recovery request/reset lifecycle.
- HTTPS-only outbound requests by default.
- Explicit origin allowlist.
- Loopback, RFC1918, link-local, metadata and local-domain blocking.
- Quarantine, scan and atomic object release.
- Existing CSRF, secure-cookie, RBAC/ABAC, idempotency and tamper-evident audit controls retained.

## Not independently certified
No penetration test, DAST campaign, cloud KMS/HSM validation or external delivery security review was performed in this workspace.
