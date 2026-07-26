# Qelly Security Control Report

## Verified locally

- HttpOnly cookie sessions, rotation and revocation.
- Session-derived CSRF protection.
- Tenant/workspace authorization, RBAC/ABAC and object scoping.
- Passkeys, encrypted TOTP secrets and replay-protected recovery codes.
- Non-enumerating password recovery with challenge expiry and attempt limits.
- Idempotency, structured errors and tamper-evident audit.
- Upload quarantine, size limits and malware-test rejection.
- Outbound destination allowlist and SSRF protections.
- Signed webhook contracts and delivery-attempt history.
- Product validation confirms live trading, custody, transfers, private-key and recovery-phrase APIs are absent.

## Remaining external evidence

- Independent penetration test, SAST/DAST service evidence, production secret/KMS operation, managed-service isolation, real malware scanner and external delivery sandboxes.
