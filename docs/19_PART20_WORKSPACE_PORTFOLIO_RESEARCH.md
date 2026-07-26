# Part 20 Workspace Operations, Portfolio Analytics and Research

## Decision

Part 20 prioritizes repeatable user workflows over another read-only data expansion. The release adds local stateful workspaces while preserving the Part 18 security hardening and Part 19 asset-intelligence foundation.

## Architecture

### Workspace operations store

`src/workspace/workspace-operations-store.mjs` owns scoped watchlists, alert rules, in-app notifications, saved screeners and research workspaces. Every record is bound to `userId`, `tenantId` and `workspaceId`. Mutations use atomic JSON replacement, local file locks, request idempotency where applicable and recursive audit-ledger events.

### Screener service

`src/workspace/screener-service.mjs` provides a typed field catalogue and deterministic cross-asset filter execution. It supports numeric and text operators, sorting and bounded result counts. It is not a distributed query engine and does not contain licensed real-time fundamentals.

### Portfolio analytics service

`src/portfolio/portfolio-service.mjs` provides a non-tradable model portfolio with internally reconciled holdings, cash, performance series, exposure, concentration, local VaR and scenario estimates. It has no connected brokerage, custodian reconciliation or order capability.

### Frontend routes

- `watchlist`
- `alert-center`
- `notification-center`
- `screener-lab`
- `portfolio-analytics`
- `research-workspace`

The routes use the packaged BFF APIs and explicitly display local-data and production-gate boundaries.

## Security and integrity

- Session-bound CSRF remains mandatory on governed mutations.
- Authorization is evaluated before scoped data access.
- Runtime JSON schemas reject unknown or invalid fields.
- Create operations support idempotency keys.
- State changes generate recursive, tamper-evident audit events.
- Development fixture identity remains rejected when production isolation is enabled.

## GitHub repository readiness

The package includes CI, container publication, tagged release automation, Dependabot, issue templates, a pull-request template, Docker assets and repository governance documents. Direct remote publication was not performed because no GitHub connector or credentials were available.

## Truth boundary

Implemented means a runnable deterministic local foundation. It does not mean:

- external alert delivery;
- cloud/cross-device synchronization;
- real-time collaboration;
- connected financial accounts;
- production portfolio reconciliation;
- licensed data;
- production-grade distributed persistence;
- trading or movement of assets.
