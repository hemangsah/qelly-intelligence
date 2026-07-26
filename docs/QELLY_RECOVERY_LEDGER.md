# Qelly Recovery Ledger

## A. Source-of-truth selection

- **Chosen archive:** `QELLY_INTELLIGENCE_GITHUB_READY_DEPLOYMENT_SOURCE.zip`
- **Why selected:** it is the exact preserved GitHub-prepared source artifact and contains the actual Node.js frontend/backend source, persistence repositories, migrations, workers and executable tests. It was used only after live GitHub verification proved that `main` contained an incomplete bootstrap transport rather than the prepared application tree.
- **Archive checksum:** `e113fb8754a6b806002b5c8662af602ba33f2a74bd56e93da43ba6326cab6148`, verified against the preserved SHA-256 sidecar before extraction.
- **Prepared manifest:** 480/480 files matched before repository-side hardening.
- **Inherited framework:** Node.js 22 ESM HTTP application with a modular static frontend.
- **Inherited database:** SQLite local/test implementation plus PostgreSQL production repository and migrations.
- **Inherited package manager:** npm.
- **Cold inherited evidence:** 60 routes, 175 API contracts, 237 tests and 248 smoke requests.
- **Current recovered product:** 61 meaningful application routes, 187 API contracts, 65 runtime schemas, 264 tests and 260 smoke requests.

## B. Genuine implementation state

### Working and tested locally

- Registration, login, logout, cookie sessions, CSRF and session rotation.
- Tenant/workspace authorization, RBAC/ABAC, idempotency and tamper-evident audit.
- Passkeys, TOTP MFA, recovery codes and non-enumerating account recovery.
- SQLite persistence for local/test use; pooled PostgreSQL application persistence plus a direct, locked, checksummed production migrator.
- Persistent jobs, delayed promotion, bounded retry, dead-letter state, duplicate suppression, leases, restart recovery, worker heartbeats and notification-attempt records.
- Quarantined uploads, deterministic malware-test rejection and local object storage.
- Public read-only market overview, rankings, asset detail and candles with source, freshness, quality and fallback evidence.
- A locally persisted, tenant-scoped Qelly Decision Provenance Graph with upstream/downstream traversal, conflict-aware evidence records, an accessible text alternative and checksum-bearing export.
- Responsive modular frontend, command palette, six operating personas and reduced-motion support.

### Implemented but deployment-dependent

- PostgreSQL, Redis job signalling, S3-compatible storage, ClamAV, external email, signed webhooks and public-provider networking require target services and credentials.
- Their production adapters, strict environment checks, startup probes, readiness gates, integration tests and operational contracts are implemented; live external evidence remains pending.
- Decision Provenance, portfolio metadata, workspace operations and the audit chain are wired to PostgreSQL in production mode.

### Fixture-backed development mode

- Several inherited discovery, portfolio, research and asset-intelligence domains use deterministic local data.
- Public market fallbacks are explicitly labelled `simulated` and `degraded`; fixture values are never presented as live.

### Visual or taxonomy only

- The 400-screen and 10,000-screen atlases remain canonical design taxonomies and do not prove workflow implementation.

### Intentionally disabled

- Live trading, custody, transfers, withdrawals, private-key handling and recovery-phrase handling.

## C. Defects and contradictions corrected

- Product identity was separated from historical release-number branding.
- Brittle tests that treated additive API/route growth as a regression were corrected.
- Conventional build, syntax/type, lint and environment-validation commands were added.
- Public launch routes now use evidence-bearing public market APIs and explicit fallback states.
- The inherited `asset-rankings` route was moved away from an authenticated fixture endpoint.
- Content Security Policy was narrowed to local scripts and fonts.
- A real persisted Decision Provenance vertical slice replaced the prior missing flagship workflow.
- Smoke validation now recognizes HTTP 201 for evidence creation rather than incorrectly requiring 200.
- Source packaging is being separated from screenshots, PDFs and historical generated archives.
- The failed GitHub bootstrap transport, placeholder payload, archive chunks and write probe were removed from the application tree.
- Stale Release A5 validation commands wired into CI were replaced with current product validation, inventory and release checks.
- CI now includes a redacting repository secret scan, immutable action pins, dependency review, CodeQL, concurrency cancellation, bounded artifact retention and PostgreSQL/Redis integration coverage.

## D. Architecture decision

Continue and refactor the inherited repository in place. The source is reusable: the cold baseline, tests and smoke suite pass; the domain modules are separated; and a framework rewrite would add risk without improving the immediate deployable launch. Migrate only layers that are incompatible with the selected host or managed services.

## E. Binding Scope A - Deployable Market Launch

1. Repository health and cold build.
2. Production-compatible environment validation and portable deployment package.
3. Existing secure identity/account foundation.
4. Canonical public crypto instrument subset.
5. Public market overview, rankings and asset detail using permitted read-only providers or explicit unavailable/simulated fallbacks.
6. Provider attribution, freshness, fallback and quality evidence on every market response.
7. Persistent authenticated watchlists and portfolio foundation.
8. Persisted Decision Provenance Graph for market observations, hypotheses, risk boundaries and considered decisions.
9. Health, readiness, logs, tests, browser evidence and deployment runbooks.

## F. Scope B - Full-platform expansion

- Wider asset classes and licensed data.
- Full exchange/DEX breadth and deep blockchain indexing.
- Complete quant laboratory and backtesting.
- Evidence-based community and governed marketplace.
- Collaboration, billing and enterprise controls.
- Read-only account connections and paper trading.
- Live execution remains separately gated.

## G. Deployment plan

- **Frontend host:** the generated `dist/frontend` static artifact on Vercel or an equivalent static host.
- **Persistent workloads:** separate API, worker and trusted operations containers on Railway, Render, Fly.io or an equivalent container host.
- **Database:** managed PostgreSQL.
- **Storage:** managed S3-compatible object storage.
- **Queue:** managed Redis or platform-compatible persistent jobs.
- **Email:** configured provider through the existing server-side adapter.
- **Observability:** structured logs plus the OpenTelemetry-compatible collector contract.
- **CI:** GitHub Actions.
- **Migrations:** run before API rollout.
- **Rollback:** redeploy the previous image and use only backward-compatible migrations; restore a verified backup when necessary.
- **Vercel:** static frontend only; no TCP scanner, worker, migrator, SSE server or persistent API process is assigned to a Vercel function.

## H. Production gates

- Clean install, syntax/type check, lint, environment validation and cold build.
- Full tests, authorization/tenancy checks, API contracts and critical browser journeys.
- Public values real or explicitly unavailable/simulated.
- PostgreSQL, Redis, storage, scanner, delivery and worker connections verified in the target environment.
- Backup/restore and rollback exercised against target infrastructure.
- No fake live labels or fixture identity in production.
- No dangerous execution or custody routes.
- Accessibility and responsive browser checks pass.
- A deployment URL is returned only after a real deployment result.

**Qelly source of truth is locked. Implementation may continue from this exact baseline.**
