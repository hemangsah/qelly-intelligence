# Qelly Intelligence

Qelly Intelligence is a verifiable financial-market intelligence platform that connects public market observations, source evidence, secure research workspaces, portfolio context and decision audit trails.

## Current deployability

**Preview deployable.** The repository runs locally and in a portable Node.js/Docker environment. It is not yet a verified public production deployment.

The launch surface includes documented public read-only market adapters with explicit attribution, freshness and degraded-state labels. When a provider is disabled or unavailable, Qelly uses deterministic fixtures labelled **simulated**; fixture values are never presented as live.

Live trading, custody, transfers, withdrawals, private-key collection and recovery-phrase collection are intentionally disabled.

## Runtime

- Node.js 22 or later
- Zero third-party npm runtime dependencies in the inherited implementation
- SQLite for local development and tests
- PostgreSQL repository and migrations for production
- Redis signalling adapter for production jobs
- Local quarantined object storage for development
- S3-compatible object-storage adapter for production

## Start locally

```bash
cp .env.example .env
npm ci --ignore-scripts
npm run check
npm run serve
```

Open `http://127.0.0.1:4480`.

Public routes do not require a session. Private workspaces require registration/login or the explicit development identity flag.

## Commands

```bash
npm run typecheck       # syntax/type-surface validation
npm run lint            # repository and frontend policy checks
npm run env:check       # environment and financial-safety validation
npm run security:scan   # redacting committed-secret scan
npm test                # unit/integration/server tests
npm run build           # creates dist/ and cold-starts it
npm run validate:product
npm run smoke
npm run inventory:product
npm run release:check
npm run migrate
npm run seed
npm run worker
```

## Public market data

Set:

```bash
QELLY_PUBLIC_MARKET_DATA_ENABLED=true
```

Qelly attempts documented public read-only market endpoints. The normalized response includes provider, source URL where permitted, observation time, ingestion time, freshness, quality state, confidence, cache state and fallback reason.

No private exchange credentials belong in frontend code.

## Decision Provenance Graph

The Scope A flagship workflow is available at `#/decision-provenance`. It persists a tenant/workspace-scoped evidence chain from source record and provider observation through normalization, market movement, user hypothesis, risk assessment and considered decision. It supports upstream/downstream traversal, an accessible text alternative and a checksum-bearing export. The local runtime is tested; the PostgreSQL migration contract is included and target-environment repository execution remains deployment-dependent.

## Production configuration

Use PostgreSQL, Redis and S3-compatible storage. Production mode also requires secure session and secret-protection keys. Run:

```bash
NODE_ENV=production npm run env:check
npm run migrate
npm run start:production
```

The existing Node HTTP architecture is immediately portable to Railway, Render, Fly.io or another container platform. A Vercel deployment requires a serverless route-handler adapter and has not been claimed as complete.

## Evidence and reports

- `docs/QELLY_RECOVERY_LEDGER.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_PROVENANCE.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/PROVIDER_LICENSING_MATRIX.md`
- `packages/openapi/`
- `packages/migrations/`
- `validation/`

## Security reporting

See `SECURITY.md`. Never submit passwords, tokens, private keys or recovery phrases in an issue or chat.
