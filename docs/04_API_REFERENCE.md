# API Reference

Base URL: `http://127.0.0.1:4480`

Part 21 exposes 130 documented route contracts. Mutations require the session-bound `X-Qelly-CSRF` token returned by `GET /api/v1/config`. Governed mutations may additionally require an `Idempotency-Key` and domain authorization.

## Platform and identity

- `GET /api/health`
- `GET /api/ready`
- `GET /api/v1/config`
- `GET /api/v1/session/context`
- `GET /api/v1/workspaces`
- `GET /api/v1/sessions`
- `GET /api/v1/devices`
- `POST /api/v1/auth/step-up/simulate` — development-only assurance simulation
- `POST /api/v1/access/evaluate`
- `GET /api/v1/privacy/consents`
- `GET /api/v1/privacy/data-inventory`

## Onboarding

- `GET /api/v1/onboarding/catalog`
- `GET /api/v1/onboarding/profile`
- `PUT /api/v1/onboarding/profile`
- `DELETE /api/v1/onboarding/profile`
- `POST /api/v1/onboarding/complete`

Profiles are scoped to the active user, tenant and workspace. Completion does not provision production infrastructure or external provider connections.

## Notification scheduling

- `GET /api/v1/notification-schedules/catalog`
- `GET /api/v1/notification-schedules`
- `POST /api/v1/notification-schedules`
- `PATCH /api/v1/notification-schedules/:id`
- `DELETE /api/v1/notification-schedules/:id`
- `POST /api/v1/notification-schedules/run-due`

`run-due` is an explicit local evaluation call. No autonomous background worker, email, SMS, push or webhook delivery is enabled.

## Formula screeners

- `GET /api/v1/screeners/formulas/catalog`
- `POST /api/v1/screeners/formulas/run`

Expressions support bounded arithmetic, approved fields and approved functions. Arbitrary JavaScript, `eval`, `Function`, property access and system calls are rejected.

## Portfolio attribution

- `GET /api/v1/portfolio/attribution?range=1y`

Returns deterministic holding, asset-class and sector contributions that reconcile to the local model portfolio total. It is not broker-reconciled, accounting-grade or investment advice.

## Import staging

- `GET /api/v1/imports/templates`
- `GET /api/v1/imports`
- `POST /api/v1/imports/preview`
- `POST /api/v1/imports/commit`
- `GET /api/v1/imports/:id`

Imports accept bounded CSV text payloads for preview and local staging. File uploads and production application are disabled.

## Research version history

- `GET /api/v1/research/workspaces/:id/versions`
- `POST /api/v1/research/workspaces/:id/versions`
- `GET /api/v1/research/workspaces/:id/versions/:versionId`
- `POST /api/v1/research/workspaces/:id/versions/:versionId/restore`
- `GET /api/v1/research/version-diff?workspaceId=...&left=...&right=...`

Snapshots, diffs and restores remain workspace-scoped, audited and idempotent where mutated.

## Database migration planning

- `GET /api/v1/platform/migrations/plan`
- `GET /api/v1/platform/migrations/status`

These endpoints expose architecture and operational gates only. They do not connect to a database or execute migrations.

## Inherited API domains

Part 21 retains the complete Part 20 API surface for market overview, search, discovery, providers, entitlements, instrument master, data quality, preferences, time series, SSE/replay, observability, audit verification, advanced asset intelligence, chart layouts, watchlists, alert rules, notifications, saved screeners, model portfolio analytics and research workspaces.

The authoritative route list is `src/server/route-manifest.mjs`. Machine-readable contracts are served through `GET /api/v1/contracts/:name`, including `onboarding-automation-attribution`.

## Error model

Errors use JSON with an `error` object containing a stable code and message. Common statuses include:

- `400` schema, formula or domain validation failure
- `401` missing/invalid session when development identity is disabled
- `403` authorization or assurance failure
- `404` scoped resource not found
- `409` optimistic revision or idempotency conflict
- `429` rate/quota limit
- `500` unexpected local runtime failure
