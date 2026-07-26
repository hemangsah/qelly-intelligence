# Release A1 Security Report

## Implemented
- Passwords are hashed with scrypt and unique salts.
- Raw session tokens are not persisted.
- Browser sessions use signed HttpOnly SameSite cookies; Secure is enabled in production mode.
- CSRF tokens are derived from the authenticated session and required for cookie-authenticated mutations.
- Session rotation revokes the prior session.
- Logout revokes the database session.
- Tenant context is derived from database membership, organization and workspace records.
- Fixture identity is unavailable in production mode.
- Authentication and job actions are audited.

## Partial / deployment dependent
- PostgreSQL row-level security policies require a dedicated least-privilege application role and live deployment tests.
- Redis transport requires TLS/auth configuration in production.
- Secret storage, cloud KMS and encryption-at-rest controls depend on the deployment platform.
- Passkeys, MFA, account recovery, suspicious-login detection and device risk are not implemented.

## Financial safety
No live order, transfer, withdrawal, private-key or recovery-phrase API is present.
