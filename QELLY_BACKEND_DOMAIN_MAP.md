# Qelly backend domain map

Audit baseline: 187 declared API routes, 65 runtime JSON schemas, and 17 domain contracts.

| Domain | Existing repository capability | Next governed expansion |
| --- | --- | --- |
| Identity | registration, login, sessions, MFA, passkeys, recovery, authorization | organization/team administration and external identity integration |
| Organizations/workspaces | scoped session context, preferences, workspace records | richer membership, roles, approvals, and shared layouts |
| Market assets | canonical instrument master, public asset observations | broader licensed coverage and temporal identity operations |
| Providers | adapters, entitlement, rate limit, retry, breaker, cache, quality | licensed adapters, provider comparison, and redistribution enforcement |
| OHLCV/timeseries | normalized history, query, append, replay | production partitioning, retention, backfill, and provider reconciliation |
| Streaming | replayable SSE and provider health | production websocket/stream adapters and multi-instance coordination |
| Discovery | overview, rankings, categories, venues, DEX, charts, news, research | governed breadth, narratives, cross-asset discovery, and current licensing |
| Asset intelligence | overview, fundamentals, filings, events, technicals, compare | deeper market, derivatives, options, liquidity, on-chain, and institutional layers |
| Derivatives | no complete domain contract | OI, funding, liquidations, positioning, basis, options, volatility, order flow, and depth |
| Research | workspaces, items, versions, diff, restore | citations, contradiction, source quality, authors, and publication workflow |
| Evidence | graphs, explain-move, traversal, integrity, export | chart-region binding, typed alternatives, review, outcomes, and checksum verification UI |
| Portfolio | overview, holdings, performance, risk, attribution | scenarios, exposure decomposition, transactions, and insight provenance |
| Watchlists/alerts | scoped lists, rules, notifications, schedules | delivery channels, provider-disagreement/freshness triggers, and provenance packages |
| Screener | catalogue, reusable screens, formula execution | advanced boolean builder, scheduling, factor library, and reproducibility |
| Imports/storage | templates, preview/commit, secure imports, quarantine, signed downloads | production storage lifecycle, retention, and governance workflows |
| Operations | jobs, readiness, observability, audit, delivery, staging assurance | multi-instance staging exercises, incident workflows, and component status history |
| Trust | coverage/methodology/status fixtures and security evidence | public component/provider status, incidents, licensing, attribution, and changelog |

## Contract rule

Any new endpoint must define authentication, authorization, tenant/workspace scope, idempotency, pagination/filtering/sorting where relevant, request/response/error schemas, audit events, and source/freshness/quality/confidence metadata.

This batch does not add speculative derivatives or provider endpoints. It records the dependency order and preserves the working backend.
