# Qelly Intelligence — Production Convergence State

Date: 2026-08-16

## Canonical production architecture

- Canonical public runtime: Cloudflare Pages (`qelly-intelligence.pages.dev`).
- Canonical application release branch: `release/qelly-global-public-beta`.
- Active repair branch: `repair/full-terminal-convergence-20260816`.
- Active convergence PR: #218.
- Supabase project ref: `ssdgfgqnjlwzkgukzeef`.
- Vercel is not an active Qelly deployment surface in this workspace.
- GitHub Pages must not be treated as a degraded/demo product. The convergence target is a same-generation frontend mirror using the canonical Cloudflare API contract; Cloudflare remains the canonical runtime/backend.

## Non-negotiable truth model

- No production route may label generated/deterministic market observations as live provider data.
- No production recovery surface may invent prices, candles, volumes, market caps, funding, OI, liquidations, breadth, or market movement.
- Missing or rights-blocked data must remain `UNAVAILABLE`.
- TradingView is an external display-only surface. Qelly does not scrape, ingest, persist, or reuse widget values for internal analytics.
- Forex Factory is an external research link only; Qelly does not scrape or ingest it.
- Execution, custody, transfers, withdrawals, wallet signing, and private-key flows remain disabled/out of scope.

## Provider status

- ECB: approved reference-rate provider path; daily/working-day reference data may be exposed with explicit observed time and delayed/reference truth state.
- Binance: internal end-user display remains blocked pending verified redistribution/display rights.
- Coinbase: internal end-user display remains blocked pending written end-user display permission.
- Blocked providers must never be represented as live merely because an endpoint is technically reachable.

## Confirmed defects found during V7 convergence

1. `qelly_ui_preferences` had RLS policies but lacked required `authenticated` table privileges, causing repeated 403 responses after login and fallback UI/profile state.
2. The production shell hard-coded `SIMULATED REFERENCE DATA` and a stale `Providers 5/6` count independent of backend truth.
3. The live-markets frontend/backend contract drifted: frontend compatibility expected an `asset` path while the Cloudflare compatibility route exposed only `catalog`, `status`, `candles`, and `ticker`.
4. Binance/Coinbase interval contracts drifted; Coinbase must not inherit Binance `4h` semantics and supports provider-specific interval mapping.
5. The public production `market-v6` route called private authenticated endpoints (`/api/v1/providers/runtime` and `/api/v1/platform/data-plane`) during anonymous startup, generating avoidable 401 console noise.
6. The public recovery layer could inject hard-coded crypto demonstration prices when public routes failed.
7. Public Asset Rankings was backed by deterministic market-scenario rows (price, volume, OI, funding, liquidations, market cap). Even though labeled as demonstration, that is not acceptable as a production market-ranking experience.
8. `main` and the release line have diverged significantly; GitHub Pages and Cloudflare therefore can present different generations of Qelly UI unless branch/deployment convergence is completed intentionally.

## Repairs already implemented on the active repair branch

- Restored authenticated preference table privileges while retaining RLS and keeping anon table access denied.
- Removed hard-coded production `SIMULATED REFERENCE DATA` and stale provider-count shell copy.
- Added/realigned live-market compatibility contracts, including provider-specific interval handling and the missing compatibility asset path.
- Removed fabricated public recovery market values.
- Reworked the production public Market renderer so it uses public provider-policy/reference contracts only and no longer causes anonymous startup 401s by calling private workspace APIs.
- Preserved TradingView as a display-only boundary and professional external research links (TradingView, Forex Factory, ECB).
- Split governed-provider symbol/interval handling from external display controls so future provider authorization cannot silently send Binance symbols/intervals to Coinbase.
- Retired the deterministic public Asset Rankings market-scenario engine from the production route; the route now follows truthful availability/reference-data boundaries rather than fixed crypto observations.
- Added/updated regression tests for no-fabrication market truth, shell labels, provider intervals, recovery behavior, and anonymous public-route API boundaries.
- Production Cloudflare build/parity checks have been passing during this repair cycle; repository/browser contract tests are being updated only where they encoded retired V5.3 behavior.

## UI convergence target

The design authority for this pass is the Qelly V7 Figma-equivalent design specification produced on 2026-08-16. The terminal direction is:

- one product shell and one market truth model;
- modern dense institutional layout with explicit evidence/source states;
- no old-school demo/fixture presentation on production routes;
- consistent signed-in profile/account/security presentation;
- consistent calculator/indicator/formula workbench styling;
- responsive desktop/tablet/mobile recomposition;
- professional embedded/outbound research surfaces where licensing and platform boundaries allow.

## Remaining work before PR #218 can be promoted

- Complete exact-head repository diagnostics and browser evidence with no runtime regressions.
- Audit all public discovery/search/news/category/venue routes for fixture/simulated market claims and either replace them with governed data or explicit non-market deterministic content.
- Finish signed-in auth/profile/account/security visual convergence after preference persistence repair.
- Verify calculator, indicator, formula, and detail-route shell convergence across desktop/mobile.
- Reconcile GitHub Pages deployment architecture with the canonical Cloudflare frontend/API contract; do not restore the old static visual preview as the user-facing GitHub deployment.
- Inspect Cloudflare production browser startup for console/network errors after merge candidate build.
- Verify Supabase logs for removal of the preference 403 pattern and no new auth/RLS regressions.
- Run complete all-screen evidence (71 routes × desktop/mobile = 142 renders) on the exact accepted head.
- Merge only after required checks pass and then verify the externally deployed Cloudflare SHA, browser startup, critical public routes, provider truth, and authenticated profile persistence.

## Safety / licensing boundary

Do not bypass provider commercial terms, authentication, RLS, or redistribution restrictions to make the terminal appear more live. Professional behavior is to expose verified live/reference data where authorized and expose an explicit unavailable state everywhere else.
