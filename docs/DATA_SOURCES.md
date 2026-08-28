# Qelly data sources

This is the authoritative operational inventory for the public beta. It describes what production code actually requests and the boundary Qelly enforces. Provider terms can change; re-verify the linked official terms before expanding fields, caching, redistribution, geography or commercial use.

| Source | Production state | Qelly use | Freshness and caching | Failure / rights boundary |
|---|---|---|---|---|
| Alternative.me | Enabled, keyless | Top-ten crypto reference fields and Fear & Greed | Upstream cadence is roughly five minutes/daily; Cloudflare source cache 60 seconds | Prominent source attribution is retained; a failed request is unavailable, not simulated |
| Hyperliquid | Enabled, keyless | Selected public `allMids` reference values | Observed at request time; Cloudflare source cache 8 seconds | Read-only info endpoint; no order, account or execution calls |
| World Bank Indicators API | Enabled, keyless | Latest non-empty annual GDP growth for selected countries | Delayed annual reference; Cloudflare source cache 3,600 seconds | Never described as real-time market data |
| European Central Bank | Enabled, keyless | Daily EUR reference rates and governed history | Fresh cache 3,600 seconds; governed stale window up to 172,800 seconds | Attributed reference data, not an executable price series; stale responses are labelled stale |
| Binance Spot public API | Disabled by policy | Quote/candle adapter retained behind the provider gate | No production request while blocked | Redistribution rights are unverified; responses explicitly report unavailable/rights blocked |
| Coinbase Exchange public API | Disabled by policy | Quote/candle adapter retained behind the provider gate | No production request while blocked | Written end-user-display permission is not on file; responses explicitly report unavailable/rights blocked |
| TradingView | Display/research only | Human-readable widget or outbound link | Controlled by TradingView; not a Qelly ingestion cache | Values are not scraped, normalized, persisted or reused as analytical inputs |
| Supabase | Enabled | Auth, preferences, workspace state, governed observations, lineage and audit data | Per-table/RPC semantics; scheduled provider and release-identity jobs | Browser uses a publishable key plus RLS; privileged keys remain server-side |
| Workers AI | Optional Cloudflare binding | Bounded intelligence responses where the configured feature invokes it | Runtime dependent | Absence degrades the capability; no fabricated model response |
| Deterministic Qelly fixtures | Tests and local demo only | Repeatable UI, contract and degraded-state tests | Static | Always labelled `simulated`; never substituted for a failed public production source |

## Public research links, not feeds

Forex Factory, CME Group, FRED, SEC EDGAR, RBI DBIE, NSE India, IMF Data, CoinMarketCap, CoinPaprika, DefiLlama, CoinGlass, Hypurrscan and X are outbound research destinations. Qelly does not scrape or silently republish them.

## Normalized truth contract

Public source envelopes expose a source identifier, truth state, observation time when available, fetch/ingestion time, attribution, cache state and failure reason. Valid truth states distinguish live, cached, delayed/reference, stale, unavailable and simulated data. Source failures remain visible and do not become zeroes or invented prices.

## Secrets and client configuration

The Supabase URL and publishable key are intentionally browser-safe identifiers and are paired with RLS and least-privilege grants. Supabase privileged credentials, provider credentials and tokens belong only in encrypted Cloudflare secrets or the target platform's secret manager. Never put a secret in `wrangler.jsonc`, public assets, examples with real values, logs or client-side storage.
