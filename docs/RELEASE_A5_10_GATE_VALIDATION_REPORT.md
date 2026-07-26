# Qelly Intelligence Release A5 - Ten-Gate Validation Report

Release: `27.0.0`
Release name: Platform Hardening and Staging Readiness

## Gate 1 - Source and repository integrity

Passed locally.

- Release A4 was used as the runnable baseline.
- The Release A5 package preserves inherited source, migrations, contracts, route modules, tests and safety gates.
- JavaScript syntax validation covered 139 `.js`/`.mjs` files.
- JSON parsing validation covered all non-runtime JSON artifacts.
- Build inventory and release manifest are generated with SHA-256 hashes.

Commands:

```text
npm run validate
npm run inventory
```

## Gate 2 - Route and API inventory

Passed.

- 60 frontend routes.
- 175 API contracts.
- 17 machine-readable contracts.
- 59 JSON schemas.
- 101 capability records.
- Three new route families: Secret Rotation, Quarantine Review and Staging Assurance.

## Gate 3 - Database and migration integrity

Passed for local and contract coverage; external services remain unexecuted.

- SQLite development/test persistence is exercised.
- PostgreSQL repository parity is tested.
- Migration `104_release_a5_platform_hardening.sql` is included and contract-validated.
- Checksum-verified SQLite backup and restore drill passes.
- Live PostgreSQL, PITR and multi-host failover remain staging work.

## Gate 4 - Authentication, authorization and tenant isolation

Passed locally.

- Signed HttpOnly sessions, session CSRF, tenant/workspace scope, RBAC/ABAC and audit remain enabled.
- Production fixture identity isolation returns 401 for anonymous and fixture-header bypass attempts.
- Versioned secret rotation is authenticated, tenant-scoped, idempotent and audited.

Command:

```text
node scripts/production-identity-check.mjs
```

## Gate 5 - Schema and contract validation

Passed.

- OpenAPI 3.1 document contains 175 paths and release version `27.0.0`.
- Runtime schemas reject malformed governed input.
- Release A5 contract marks KMS, ClamAV daemon, external staging and cloud services honestly as partial or deferred.

## Gate 6 - Functional tests and smoke coverage

Passed.

- `npm test`: 237/237 passed.
- `npm run smoke`: 248/248 full-stack requests passed.
- New coverage includes keyring rewrap, legacy-envelope compatibility, quarantine rescan/release/discard, ClamAV adapter contract, delivery signature verification, idempotency concurrency, backup/restore and staging-manifest behavior.

## Gate 7 - Frontend, responsive and accessibility coverage

Passed for automated local evidence; independent certification remains.

- 60 routes rendered at desktop and mobile.
- 120/120 screen renders passed.
- Zero browser console errors.
- Zero detected page-level horizontal-overflow failures.
- 36/36 focused semantic, keyboard-entry, responsive and reduced-motion checks passed.
- The accessibility result is not an independent WCAG 2.2 AA certification.

## Gate 8 - Performance and reliability

Passed for bounded local exercises; cloud capacity is not claimed.

- Local concurrency/idempotency drill passes.
- Signed-delivery sandbox verification passes.
- Checksum backup/restore drill passes.
- All 120 browser captures completed without detected console or page-overflow failure.
- Multi-host load, stress, soak, chaos, Redis failover, PostgreSQL failover and cloud latency tests remain.

## Gate 9 - Security and financial-safety boundaries

Passed.

- Versioned AES-256-GCM envelopes use server-only key material.
- Legacy encrypted envelopes remain readable for migration.
- Untrusted imports remain quarantined until clean scanner evidence.
- Explicit discard and audit evidence are implemented.
- Outbound HTTPS/SSRF restrictions from A4 remain active.
- Live trading, custody, transfers, withdrawals, private keys and recovery phrases remain disabled.

## Gate 10 - Packaging and cold-start readiness

Release-tree validation passed. Final cold-extraction results are recorded in the separate cold-extraction log after package sealing.

User-facing artifacts verified:

- Offline frontend review HTML.
- API-connected frontend source ZIP.
- 120-image all-screen ZIP.
- 68-page explanation and all-screen PDF.
- Editable Release A5 Figma development plugin.
- PDF preflight: 68 pages, openable, unencrypted, non-scanned, no warnings.
- All 68 PDF pages rendered successfully; representative beginning, public-route, A5-route and final pages were visually inspected.

## Truth boundary

This is a verified local production-foundation release, not evidence of an external commercial deployment. PostgreSQL, Redis, MinIO/S3, ClamAV, KMS/HSM, external email/webhook providers and cloud staging are implemented as code, adapters or deployment contracts where stated, but were not live services in this workspace.
