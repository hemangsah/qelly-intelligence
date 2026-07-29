# Qelly Prompt 2A Provider and Embed Evidence Register

Verified: 2026-07-29 16:55 IST  
Audited product base: `26d2c9c453992b74dd3931d6b8b9489117d0b44c`

This register records official documentation and terms evidence only. It does not classify any external market, broker, exchange, wallet, bank, news or observability provider as production-connected. Runtime endpoint probes are executed separately on the exact audit head and retained in the final artifact.

## High-confidence decisions

- **CoinDCX public market data — `BLOCKED_PROVIDER_TERMS` for public display.** Its official API terms prohibit redistribution, display or dissemination of market data and derived charts, analytics, research or other works to third parties. It must not remain in Qelly's public-display critical path without written authorization.
- **Zerodha Kite — `APPROVED_USER_AUTH_ONLY` for read-only account use; public market-data display blocked.** Official terms state that live market data obtained through Kite Connect cannot be displayed to the public at large and may not be used for virtual/mock trading apps.
- **SEC EDGAR — `APPROVED_CORE` for server-side US filing ingestion.** No API key is required; `data.sec.gov` does not support browser CORS; a declared User-Agent and the fair-access rate ceiling are mandatory.
- **FRED — `APPROVED_OPTIONAL` with series-level license controls.** An API key is required, the prescribed non-endorsement notice is mandatory, and each series may carry third-party rights.
- **OpenFIGI V3 — `APPROVED_OPTIONAL`.** Free anonymous mapping exists with lower limits; server-side caching, identifier lineage and current terms review are required.
- **TradingView widgets/library — `APPROVED_EMBED_ONLY`.** Attribution and branding must remain. Qelly must not treat embed output as its native data API or export/repackage the data.
- **Yahoo Finance unofficial endpoints — `REMOVE` from the production-critical dependency graph.** No Yahoo production dependency was found in source, package or lockfile scans.

## Official evidence registry

| Provider | Documentation | Terms / policy | Decision |
|---|---|---|---|
| Qelly deterministic local engine | repository `src/public-beta` | not applicable | `IMPLEMENTED_DETERMINISTIC_LOCAL` / `APPROVED_CORE` |
| GitHub Pages | `docs.github.com/pages` | GitHub Terms | `IMPLEMENTED_CONNECTED` / static hosting only |
| Binance Spot Market Data | `developers.binance.com` Spot REST/WebSocket docs | Binance Terms | `PARTIAL` / `EXPERIMENTAL`; redistribution review required |
| CoinDCX Market Data | `docs.coindcx.com` | CoinDCX API Terms | `BLOCKED_PROVIDER_TERMS` |
| CoinGecko API | `docs.coingecko.com` | CoinGecko Terms | `REQUIRES_LICENSE` / `APPROVED_OPTIONAL` |
| Coinbase Exchange Market Data | Coinbase Developer Platform Exchange docs | Coinbase Market Data Terms | `REQUIRES_LICENSE` / `EXPERIMENTAL` |
| Kraken Public Market Data | `docs.kraken.com/api` | Kraken legal terms | `REQUIRES_LICENSE` / `EXPERIMENTAL` |
| OpenFIGI API v3 | `openfigi.com/api/documentation` | OpenFIGI Terms | `REQUIRES_LICENSE` / `APPROVED_OPTIONAL` |
| SEC EDGAR APIs | SEC EDGAR API documentation | SEC privacy/fair-access policy | `PLANNED` / `APPROVED_CORE` |
| FRED API | FRED API documentation | FRED Terms of Use | `PLANNED` / `APPROVED_OPTIONAL` |
| World Bank Indicators API | World Bank developer information | dataset-specific terms | `PLANNED` / `APPROVED_OPTIONAL` |
| Frankfurter FX API | `frankfurter.dev` | provider terms | `PLANNED` / `EXPERIMENTAL` |
| GDELT | GDELT DOC 2.0 documentation | GDELT terms/about | `PLANNED` / `EXPERIMENTAL` |
| Polymarket public data | Polymarket docs | Polymarket terms | `BLOCKED_REGULATION` / `EXPERIMENTAL` |
| TradingView widgets | TradingView widget docs | TradingView policies | `IMPLEMENTED_EMBEDDED` / `APPROVED_EMBED_ONLY` |
| Reown AppKit / WalletConnect | Reown AppKit docs | Reown terms | `REQUIRES_AUTHORIZATION` / `APPROVED_USER_AUTH_ONLY` |
| MetaMask SDK | MetaMask SDK docs | Consensys terms | `REQUIRES_AUTHORIZATION` / `APPROVED_USER_AUTH_ONLY` |
| Zerodha Kite Connect | Kite Connect v3 docs | Kite terms | `BLOCKED_PROVIDER_TERMS` for public display; user-auth only |
| Upstox Developer API | Upstox developer docs | Upstox terms | `REQUIRES_AUTHORIZATION` / `APPROVED_USER_AUTH_ONLY` |
| Angel One SmartAPI | SmartAPI docs | Angel One terms | `REQUIRES_AUTHORIZATION` / `APPROVED_USER_AUTH_ONLY` |
| Interactive Brokers APIs | IBKR API documentation | IBKR policies | `REQUIRES_LICENSE` / `APPROVED_USER_AUTH_ONLY` |
| Alpaca Market Data API | Alpaca market-data docs | Alpaca disclosures | `REQUIRES_LICENSE` / `APPROVED_OPTIONAL` |
| Yahoo Finance unofficial endpoints | no official production API | Yahoo Terms | `DEPRECATED` / `REMOVE` |

## Runtime-probe boundary

Endpoint viability is not licensing, redistribution, production-readiness or connectivity evidence. The exact-head GitHub Actions audit performs bounded low-rate public endpoint probes and records HTTP, schema, timing and error evidence. A successful HTTP response is never sufficient for `IMPLEMENTED_CONNECTED`; authorization, license, canonical mapping, resilience, observability and production evidence remain mandatory.
