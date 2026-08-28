# Qelly Intelligence

Qelly Intelligence is a verifiable financial-market intelligence platform that connects public market observations, source evidence, secure research workspaces, portfolio context and decision audit trails.

## Current deployability

**Public beta deployed.** The canonical Cloudflare Pages deployment is [qelly-intelligence.pages.dev](https://qelly-intelligence.pages.dev). The repository also runs locally and retains a portable Node.js/Docker runtime for environments that need the persistent worker and storage adapters.

The public launch surface uses Cloudflare Pages Functions with Supabase Auth/Postgres and documented read-only sources. Every market response carries source, observation time, ingestion/fetch time, freshness, cache state and an explicit truth state. A failed public source remains **unavailable**; Qelly does not invent a live fallback. Deterministic fixtures are limited to local demonstrations and tests and are always labelled **simulated**.

Live trading, custody, transfers, withdrawals, private-key collection and recovery-phrase collection are intentionally disabled.

## Runtime

- Node.js 22 or later
- Locked `pg` runtime dependency for pooled and direct PostgreSQL connections
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
npm run build:frontend  # creates the static dist/frontend artifact
npm run inventory:design # regenerates governed route/component/Figma matrices
npm run validate:design  # validates tokens, shell, personas, and 411-frame contract
npm run validate:product
npm run smoke
npm run inventory:product
npm run release:check
npm run migrate
npm run seed
npm run worker
```

## Public market data

The Cloudflare public runtime enables only sources whose current use boundary is recorded in [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md). Binance and Coinbase adapters remain present but return an explicit unavailable/rights-blocked envelope until redistribution or end-user-display permission is verified.

For the portable Node runtime, set:

```bash
QELLY_PUBLIC_MARKET_DATA_ENABLED=true
```

Qelly then attempts documented public read-only endpoints. The normalized response includes provider, source URL where permitted, observation time, ingestion time, freshness, quality state, confidence, cache state and fallback reason.

No private exchange credentials belong in frontend code.

## Decision Provenance Graph

The Scope A flagship workflow is available at `#/decision-provenance`. It persists a tenant/workspace-scoped evidence chain from source record and provider observation through normalization, market movement, user hypothesis, risk assessment and considered decision. It supports upstream/downstream traversal, an accessible text alternative and a checksum-bearing export. Local and PostgreSQL implementations are tested; target-environment execution remains deployment-dependent.

## Production configuration

There are two supported deployment shapes:

- The canonical public beta uses `wrangler.jsonc`, `dist/frontend`, Cloudflare Pages Functions and a browser-safe Supabase publishable key; authenticated writes forward the user's JWT through the same-origin facade. No Supabase service-role credential is shipped to the browser. Cloudflare Workers AI is an optional binding.
- The portable full Node runtime uses `.env.preview.example` or `.env.production.example`. Strict deployment also requires PostgreSQL, TLS Redis, private S3, private ClamAV, external email, signed webhooks, an active worker, secure session and keyring material.

For the Node runtime, run migrations from the operations job before the API:

```bash
NODE_ENV=production npm run env:check
npm run migrate
npm run migrate -- --status
npm run start:production
```

The Node API and worker use separate persistent container images. `vercel.json` is retained only as a portable static-hosting manifest for `dist/frontend`; there is no active Vercel project, and no worker, TCP scanner, migration, Redis consumer, SSE server, or persistent Node process is assigned to a Vercel function.

## Evidence and reports

- `QELLY_PRODUCT_ARCHITECTURE.md`
- `QELLY_INFORMATION_ARCHITECTURE.md`
- `QELLY_DESIGN_PRINCIPLES.md`
- `QELLY_FRONTEND_ARCHITECTURE.md`
- `QELLY_FIGMA_HANDOFF.md`
- `QELLY_VALIDATION_REPORT.md`
- `docs/QELLY_RECOVERY_LEDGER.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_SOURCES.md`
- `docs/DATA_PROVENANCE.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/PROVIDER_LICENSING_MATRIX.md`
- `packages/openapi/`
- `packages/migrations/`
- `validation/`

## Security reporting

See `SECURITY.md`. Never submit passwords, tokens, private keys or recovery phrases in an issue or chat.
