# Qelly V9 Repair State

Last substantive repair session: 2026-08-18

This document is the durable continuation point for Qelly terminal convergence. It intentionally contains no secrets or user PII.

## Active release work

- Repository: `hemangsah/qelly-intelligence`
- Pull request: `#224` — Converge Qelly V8 live data terminal and mirror parity
- Repair branch: `repair/qelly-v8-live-terminal-convergence-20260817`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev/`
- Public mirror: `https://hemangsah.github.io/qelly-intelligence/`

Always recover the current exact PR head from GitHub before making a new claim about CI or deployment.

## Product truth contract

1. Never fabricate a market value in connected production.
2. Upstream failure remains `STALE`, `UNAVAILABLE` or `ERROR`.
3. A technically reachable provider is not automatically permitted for internal redistribution.
4. Execution and custody remain disabled unless independently implemented and proven.
5. External widgets and research links are a display/research boundary, not an ingestion license.
6. Cloudflare is canonical; GitHub Pages mirrors the product and calls canonical APIs where needed.

## Provider state

### Approved / usable paths

- Hyperliquid — public fast market observations through the Cloudflare market-network owner.
- Alternative.me — public market/sentiment observations through the Cloudflare market-network owner.
- ECB — governed delayed/reference FX data persisted through Supabase.
- World Bank — public macro reference observations through the Cloudflare market-network owner.

### Rights-gated providers

- Binance — registry remains in verification with commercial/redistribution rights unverified.
- Coinbase — registry remains in verification with commercial/redistribution rights unverified.

Do not relabel these providers as internally live until explicit rights evidence is recorded in the provider registry.

## Research/display links

The market-network owner includes professional research destinations such as TradingView, Forex Factory, ECB, World Bank, DefiLlama, CoinGlass, Hypurrscan and market-reference sites. These should appear in contextually relevant market/research surfaces, not be spammed across account/auth pages.

TradingView is display-only. If the widget fails or embedding is blocked, render a clean direct-link fallback; do not substitute a chart.

## CI repair completed

The V8 acceptance workflow previously applied production `QELLY_*` environment variables to the entire job, including repository tests. That made `npm test` fail while the same exact SHA passed the repository diagnostic workflow.

The workflow now runs repository tests in a clean environment and applies production capability variables only to the production frontend build. Do not revert this separation.

## Supabase production state

- Project ref: `ssdgfgqnjlwzkgukzeef`
- Region: `us-east-1`
- Provider ingestion Edge Function: `qelly-provider-ingestion`
- Deployed function version at this handoff: `6`

The ECB ingestion repair is now persisted both in Supabase and repository source at:

`supabase/functions/qelly-provider-ingestion/index.ts`

Behavior:

1. Reuse fresh governed cache.
2. After historical backfill, prefer the small official ECB daily XML for routine refresh.
3. Fall back to the official 90-day XML if daily retrieval fails.
4. If both official sources fail but the last valid cache remains inside `stale_until`, return explicitly stale governed data instead of a 502 or fabricated value.
5. Return unavailable/upstream failure only when no valid source and no valid stale cache remain.
6. Keep the existing custom `x-qelly-ingestion-key` authorization boundary; do not disable it to trigger a refresh manually.

## Supabase security findings

- RLS is enabled across user/workspace and governed data tables.
- Provider/readiness/time-series base tables are deliberately browser-denied.
- `qelly_market_data_snapshot` is an authenticated browser/API path and has real production traffic.
- `qelly_market_data_snapshot` and `qelly_timeseries_history` are `SECURITY DEFINER` RPC boundaries because the underlying tables are not directly browser-readable.

Do not blindly switch these RPCs to `SECURITY INVOKER` or revoke authenticated execution; that can break the terminal. Any redesign must first provide equivalent safe RLS/view access and pass authenticated runtime evidence.

Outstanding Supabase platform advisories:

- leaked-password protection is disabled; the currently connected management surface does not expose a safe setting mutation in this workflow, so do not claim it is fixed until it is actually enabled.
- `pg_net` is installed in `public` and is not relocatable in-place; moving it requires a dependency-aware drop/recreate plan and must not be performed casually.
- the controlled `SECURITY DEFINER` RPCs remain an explicit reviewed architectural exception until replaced with an equally safe data boundary.

## V9 design lock

Canonical repository design acceptance document:

`docs/design/QELLY_V9_TERMINAL_DESIGN_LOCK.md`

Implementation convergence stylesheet:

`apps/web/public/assets/qelly-production-v9-route-convergence.css`

Loaded by:

`apps/web/public/assets/qelly-production-v8.mjs`

Primary visual repairs cover:

- sign-in / registration / recovery access surfaces,
- account, profile and current-session hierarchy,
- formula detail / calculator / indicator customer route classification,
- deterministic analytical presentation without using a simulated visual badge,
- larger readable typography, touch-sized controls and responsive stacking,
- technical IDs moved behind disclosure,
- legacy micro-density reduced on customer routes.

Existing V8 route repairs still own saved calculations, research evidence, theme personas, calculator/indicator KPI strips, dark controls and TradingView failure state.

## Regression tests

`tests/qelly-v8-live-terminal-convergence.test.mjs` now locks:

- no simulated connected market state,
- no fabricated market fallback,
- Cloudflare + GitHub live-market acceptance,
- TradingView failure without fabricated charting,
- V9 convergence CSS/runtime loading,
- customer classification of detail routes,
- ECB daily-first/history-fallback/stale-preservation behavior.

## Vercel state

The connected Vercel team currently has no Qelly project. Do not claim Vercel deployment parity or invent a Vercel terminal URL. A future Vercel deployment should be created deliberately and then added to release parity tests.

## Release procedure

Before merging PR #224:

1. Recover the exact current PR head.
2. Require successful exact-head runs for:
   - Qelly V8 Live Terminal Acceptance,
   - Qelly Repository Test Diagnostics,
   - Qelly Cloudflare Production Parity,
   - Qelly Corrective Branch Validation,
   - Qelly Prompt 2C Public Runtime,
   - Qelly GitHub Pages Public Mirror,
   - Qelly Complete All-Screens Evidence.
3. Do not merge a red or incomplete exact head.
4. After merge, verify the resulting release SHA on canonical Cloudflare runtime and GitHub mirror.
5. Verify `/api/v1/market/network` has `fabricatedFallback:false`, a fast public source, governed ECB reference rows and no connected `simulated` state.
6. Verify auth/profile customer routes and formula/calculator/indicator detail routes visually on desktop and mobile.
7. Record any remaining platform limitation explicitly instead of labelling it complete.

## Continuation rule

If a future chat is asked to "continue Qelly", start from PR #224 and this file, then re-query GitHub, Supabase, Cloudflare canonical runtime and any relevant deployment/email evidence. Historical SHAs in conversation text are never the current source of truth.
