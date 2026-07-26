# Qelly Deployment Status

## Current deployability

**Preview deployable**

The repository cold-installs, typechecks, lints, scans for committed secrets, runs 251 tests, builds, validates the current product contract, inventories the current source, and passes 259 full-stack smoke requests locally.

The authoritative GitHub target is `hemangsah/qelly-intelligence` on `main`. A GitHub commit or successful workflow is claimed only when verified from the remote repository and GitHub Actions. No public application deployment URL is currently claimed.

## Verified repository-side baseline

- 61 registered application routes
- 185 documented API contracts
- 65 runtime JSON schemas
- 17 served domain contracts
- PostgreSQL migrations through `105_scope_a_decision_provenance.sql`
- Redis job signalling adapter and persistent worker
- private S3-compatible storage adapter
- ClamAV, transactional-email, and signed-webhook boundaries
- strict production readiness without silent local fallbacks
- current CI, dependency review, CodeQL, container, and tagged-release workflows

## Required external actions

1. Protect `main` and require the verified GitHub Actions checks.
2. Provision managed PostgreSQL, Redis, private S3-compatible storage, ClamAV, transactional email, and secure webhook destinations.
3. Configure production session, encryption, delivery, and signing secrets through managed secret interfaces.
4. Run migrations and target-environment integration tests.
5. Deploy the API and worker to a persistent container platform and use Vercel only for compatible frontend/serverless workloads.
6. Verify health, readiness, critical journeys, logs, monitoring, alerts, backup/restore, and rollback.
7. Complete independent security, accessibility, privacy, provider-licensing, and legal gates.
