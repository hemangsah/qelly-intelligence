# Qelly Data Source Registry — Prompt 2A Wave 0

Audited base: `26d2c9c453992b74dd3931d6b8b9489117d0b44c`  
Generated: `2026-07-29T16:55:00+05:30`

## Priority policy

1. deterministic local calculation;
2. official public REST API;
3. official public WebSocket;
4. official free/demo tier;
5. official RSS/Atom feed;
6. official embed;
7. user-authorized official provider API;
8. paid/licensed provider only where unavoidable.

## Repository truth

- The public GitHub Pages product is a static/read-only visual preview.
- Qelly local deterministic data and GitHub Pages are the only currently connected records.
- Binance/CoinDCX live-market adapter source exists, but the feature flag defaults disabled and provider fallback may become explicitly simulated; this is `PARTIAL`, not connected product evidence.
- No external broker, wallet, exchange, bank, news or production observability integration is connected.
- Every future data observation must include source, observed-at, freshness, lineage, confidence, entitlement and truth-state metadata.

## Core candidates

- SEC EDGAR: official US filings/XBRL, server-side fair-access ingestion.
- Government and central-bank public data: source-specific licensing and effective-date controls.
- OpenFIGI V3: optional identifier mapping, not a universal instrument-master license.
- TradingView: official embed only, not native-data substitution.
- User-authorized broker/wallet APIs: read-only first with server-side secret references, revocation and audit.

## Rejected or quarantined

- CoinDCX public display without written rights.
- Yahoo Finance unofficial/reverse-engineered endpoints.
- Browser scraping, hidden fixtures, silent fallback and APIs without timeout/retry/circuit-breaker, terms, source or freshness labels.
