# Qelly Intelligence Architecture

Qelly currently uses a modular Node.js 22 ESM application. `src/server` exposes the HTTP API and static frontend. Domain modules live under `src/`; schemas, contracts, migrations, design tokens and OpenAPI live under `packages/`. `apps/worker` processes persistent jobs.

The architecture remains a modular monolith with explicit domain boundaries. This is appropriate for the launch scope because it preserves transaction and authorization consistency while allowing provider, worker and storage adapters to be replaced independently.

## Main boundaries

- Public read-only routes use canonical identifiers and source evidence.
- Authenticated routes resolve user, organization and workspace context.
- Mutable APIs apply validation, CSRF where applicable, authorization, idempotency and audit.
- Persistence is repository-backed: SQLite locally and PostgreSQL in production.
- Jobs persist in the database; Redis is a production signalling adapter.
- Object storage is quarantined locally and S3-compatible in production.
- Live trading and custody domains are absent by design.
