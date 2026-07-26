# Release A4 Frontend and Backend Progress

Generated: 2026-07-25T12:17:19.019413Z

## Frontend completed

- 57 runnable routes.
- New public Account Recovery route with request and reset states.
- New authenticated Platform Readiness route.
- Existing login, registration, sessions, onboarding, MFA, passkeys, secure imports, delivery operations, markets, discovery, research, portfolio and operations routes preserved.
- Six operating personas and the locked Qelly burgundy gradient preserved.
- 114 desktop/mobile screen captures passed with zero console errors or horizontal-overflow failures.
- 30 focused semantic, keyboard-entry and responsive checks passed.

## Frontend remaining

- Independent WCAG 2.2 AA certification with NVDA, JAWS, VoiceOver and TalkBack.
- Firefox, Safari and physical-device browser certification.
- Production CDN/SSR/code-splitting measurement and final performance budgets.
- Cloud-hosted visual-regression service and staging deployment.
- Native Figma cloud publication requires an authenticated Figma connection.

## Backend completed

- 165 documented API contracts.
- 16 machine-readable contracts and 58 JSON schemas.
- 228/228 automated tests and 237/237 smoke requests.
- Non-enumerating account-recovery requests.
- Single-use expiring recovery challenges with attempt limits.
- Password reset with all-session revocation and audit events.
- HTTPS-only outbound network policy with origin allowlisting and private/loopback/metadata blocking.
- Secure-import quarantine, scan and atomic release.
- Consolidated platform readiness API.
- Existing PostgreSQL, Redis, object-storage, MFA, passkey, audit, provider, worker and backup/restore foundations preserved.

## Backend remaining

- Live PostgreSQL, Redis and MinIO integration execution in CI/staging.
- Cloud KMS/HSM provider and key rotation.
- Full malware-scanner provider integration.
- External email and signed-webhook sandbox verification.
- Multi-instance concurrency, load, stress, soak and chaos tests.
- Cloud staging deployment, independent penetration test and disaster-recovery exercise.
- Release B live global-market and blockchain data plane after A4 infrastructure validation.

## Roadmap estimate

- Frontend Release A production-foundation scope: **88% complete**.
- Backend Release A production-foundation scope: **93% complete**.

These percentages are dependency-roadmap estimates, not code coverage or commercial-readiness claims.
