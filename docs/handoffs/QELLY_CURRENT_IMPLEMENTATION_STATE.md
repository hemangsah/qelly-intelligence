# Qelly Intelligence — current implementation state

Updated: 2026-08-28

This is the durable cross-session summary. Git history preserves earlier convergence handoffs and repair details.

## Canonical production

- Repository: `hemangsah/qelly-intelligence`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev`
- Production baseline audited for this update: `ce950857f34fb097ea0ff497ebd70b50dc57a1db`
- Active repair branch: `repair/qelly-autonomous-production-audit-20260828`
- Supabase production project: `ssdgfgqnjlwzkgukzeef`
- Vercel: no active Qelly project; `vercel.json` is a portability manifest, not the production path

Cloudflare Pages serves the static SPA and same-origin Pages Functions. Supabase supplies Auth, RLS-protected PostgreSQL and Edge Functions. The deployed Cloudflare source revision matched the release-branch baseline at audit start.

## Non-negotiable truth boundaries

1. Qelly is research-first and read-only. Trading, custody, transfers, withdrawals, private-key handling and recovery-phrase handling remain absent.
2. Production provider failures remain unavailable. No deterministic or generated market value may be presented as live.
3. TradingView is a human-readable display/research boundary. Widget values are not silently ingested or reused in Qelly analytics.
4. Binance and Coinbase remain policy-blocked until the relevant redistribution/end-user-display rights are proven. A Gmail audit through this update found no Coinbase approval response.
5. ECB reference rates are governed delayed/reference data with attribution, not executable prices.
6. Alternative.me, Hyperliquid and World Bank are bounded public reference sources. Their exact production use is recorded in `docs/DATA_SOURCES.md`.

## Audited production state

- 29 governed instruments and 29 governed time-series.
- 2,001 persisted time-series observations at the audit point.
- All application tables reported RLS enabled.
- Recent scheduled provider-ingestion and release-identity jobs were succeeding.
- The two Supabase Security Advisor function warnings are intentional authenticated read facades. Both reject missing users, cap inputs, set an empty `search_path`, use fully qualified relations and revoke execution from `public` and `anon`.
- Leaked-password protection remains a platform/plan setting rather than a repository defect.
- `qelly-auth-canary-cleanup-c53d3a11` is a retired HTTP 410 tombstone whose cleanup is complete; it is an exact remote-deletion candidate when a deletion-capable Supabase operation is available.
- Performance Advisor unused-index notices are not sufficient evidence for deletion on this young, mostly sparse workload.

## Current repair scope

The production browser audit reproduced a navigation race: the URL changed while the previous route remained visible until its asynchronous render completed. The repair aborts stale route work, paints a route-specific stable shell immediately and tears down both market widget lifecycle owners. Regression coverage is in `tests/authenticated-ui-completion.test.mjs`.

Authoritative current docs:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_SOURCES.md`
- `docs/DATA_PROVENANCE.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/PROVIDER_LICENSING_MATRIX.md`
