# Qelly Intelligence product architecture

Status: canonical first-batch architecture
Baseline: GitHub `main` at `5dd8b424426bc544bd2f925cfaeeea9a8fe6df6f`

## Product identity

Qelly is an evidence-backed market-intelligence and quantitative-research operating system. Its differentiator is not a larger collection of charts: every observation, transformation, explanation, considered decision, and outcome can retain a traceable evidence history.

The product composition is intentionally asymmetric:

- public and company routes use spacious, editorial storytelling;
- market and asset workspaces use stable, high-density analytical layouts;
- research routes privilege citations, contradiction, versions, and evidence;
- operational routes privilege dependency status, controlled actions, and audit records.

## Governing product layers

1. **Public narrative** — identity, product, methodology, trust, learning, and developer entry points.
2. **Market intelligence** — discovery, asset breadth, charts, venues, and eventually governed derivatives and flow intelligence.
3. **Research system** — research workspaces, filings, events, citations, contradictions, and version history.
4. **Decision Provenance** — typed nodes and relationships from source through observation, transformation, hypothesis, risk, considered decision, and outcome.
5. **Workspaces** — portfolio, watchlists, alerts, screens, imports, comparison, and saved research.
6. **Data plane** — canonical instruments, providers, observations, timeseries, streams, quality, entitlements, and cache state.
7. **Control plane** — identity, tenant/workspace scope, jobs, audit, delivery, storage, scanning, readiness, and observability.

## Truth contract

Any value rendered as intelligence must be able to carry:

- canonical entity identifier;
- provider and source;
- observation, receipt, and ingestion times;
- units, currency, and methodology version;
- freshness, quality, confidence, cache state, and fallback reason;
- entitlement and redistribution boundary where applicable.

The UI labels live, delayed, estimated, derived, demo, fallback, stale, and unavailable states explicitly. Demo and fallback records are never labelled live.

## Deployment boundary

The existing production architecture remains intact:

- GitHub Pages hosts only a **Static visual preview** with deterministic, read-only demo records;
- the persistent API and worker remain container-hosted concerns;
- PostgreSQL, Redis, private storage, ClamAV, email, and webhooks remain external dependencies;
- static-preview behavior is selected at build time and does not weaken production authentication, CSRF, CORS, cookies, readiness, or dependency requirements.

## Delivery model

The transformation proceeds through dependency-ordered pull requests. This batch establishes the governed design contract, shell, persona behaviors, route/screen inventories, state primitives, and editable Figma generator. Market, derivatives, research, portfolio, and backend-domain expansion remain later reviewable batches.
