# Qelly Intelligence — Current Production Convergence State

Updated: 2026-08-16
Purpose: durable cross-chat implementation handoff. Read this before continuing Qelly work.

## Canonical product and deployment

- Repository: `hemangsah/qelly-intelligence`
- Canonical public runtime: `https://qelly-intelligence.pages.dev`
- Canonical release branch: `release/qelly-global-public-beta`
- Release baseline before this repair: `9f29f33cbbe898a817082b11047a96389d99d201`
- Active repair branch: `repair/full-terminal-convergence-20260816`
- Active draft PR: #218 — `Converge Qelly V7 terminal runtime, APIs, data truth and UI`
- Supabase project reference: `ssdgfgqnjlwzkgukzeef`
- Connected Vercel team currently has no Qelly project; Vercel is not part of the production path.

Qelly is evidence-first, research-first and read-only. Do not add trade execution, custody, wallet signing, private-key/recovery-phrase handling, withdrawals, transfers or money movement.

Do not mix Qelly with the separate Wix project.

## Non-negotiable production truth

1. Cloudflare is the canonical executable web runtime.
2. Production must never label governed provider data as simulated.
3. Missing or rights-blocked market observations remain unavailable; no generated or fixed market-price fallback is permitted.
4. TradingView is an external human-readable display boundary. Widget values are not scraped, persisted or reused by Qelly analytics.
5. Forex Factory is an outbound research surface only; Qelly does not scrape or ingest it.
6. Binance and Coinbase remain unavailable for internal end-user market display until commercial/redistribution/display rights are proven.
7. ECB reference-rate data is the currently approved governed market/reference provider in the persisted production data plane.
8. Qelly remains read-only: no orders, custody, wallet signing, transfers or withdrawals.

## Design authority

V7 is the active design/convergence wave. The implementation principles are:

- dense institutional command shell;
- one visual generation across market, account/profile, quant/calculator/indicator and operational surfaces;
- explicit evidence/truth labels;
- modern responsive grids rather than desktop slices on mobile;
- external provider/source actions clearly separated from Qelly analytical state;
- no production demo/simulated market values.

Repository-native design sources remain relevant:

- `docs/design/QELLY_TERMINAL_DESIGN_SOURCE.md`
- `docs/design/qelly-terminal-tokens.json`
- `docs/design/QELLY_COMPONENT_LIBRARY.md`
- `docs/design/qelly-route-layouts.json`
- `docs/design/QELLY_DATA_PROVIDER_AND_EMBED_SURFACES.md`
- `docs/design/prototype/index.html`

A V7 Figma-equivalent PDF/PPTX artifact was also produced during the 2026-08-16 convergence session; treat the implementation principles above as the durable repository contract.

## Current governed data state

At the production audit point:

- 29 governed ECB FX series.
- 1,885 persisted time-series observations.
- Binance: 0 governed series / 0 persisted points.
- Coinbase: 0 governed series / 0 persisted points.
- Provider cache: ECB only; no demo/Binance/Coinbase market-payload residue found.

## Provider rights state

- Binance quote/candles adapter exists but remains `enabled:false`; redistribution/end-user display rights are not proven.
- Coinbase quote/candles adapter exists but remains `enabled:false`; written end-user display/redistribution permission is not proven.
- Coinbase guidance request was sent by email on 2026-08-11; no approval response was found in the latest Gmail audit.
- ECB FX reference rates are enabled as delayed/reference data with attribution.
- TradingView is display-only.
- Forex Factory is outbound research only.

Do not enable Binance/Coinbase merely because their endpoints are technically reachable.

## Production defects repaired in PR #218

### Authenticated UI preferences 403

Production Supabase logs showed `qelly_profiles` and `qelly_workspaces` succeeding while `qelly_ui_preferences` returned HTTP 403 after login. RLS policies were correct, but `authenticated` lacked table privileges.

Applied to production and source-controlled:

`supabase/migrations/20260816110500_qelly_ui_preferences_authenticated_grants_v1.sql`

The migration:

- revokes all table privileges from `anon`;
- grants SELECT/INSERT/UPDATE/DELETE to `authenticated`;
- preserves existing owner/workspace RLS authorization.

Regression coverage: `tests/qelly-ui-preferences-grants.test.mjs`.

### False `SIMULATED REFERENCE DATA` production shell

`apps/web/public/assets/qelly-v53-lock-shell.mjs` hard-coded both `SIMULATED REFERENCE DATA` and `Providers 5/6` into the production shell. Those values were removed. The shell now reports `MARKET DATA · GOVERNED PROVIDER TRUTH` or route-governed evidence without inventing provider counts.

### Fabricated public recovery prices

`apps/web/public/assets/qelly-public-recovery.mjs` previously injected fixed crypto recovery values. Those market values were removed. Recovery now renders explicit unavailable/no-fabrication evidence and compliant external research links.

### Anonymous Market Command startup 401

Root cause was identified precisely: `scripts/finalize-public-runtime.mjs` routes public `#/market` through `apps/web/public/assets/routes/market-v6.mjs`, and that public renderer called authenticated endpoints:

- `/api/v1/providers/runtime`
- `/api/v1/platform/data-plane`

Those calls produced browser 401 responses which were caught by the renderer, allowing the page to appear usable while polluting startup and evidence.

The canonical public Market renderer now uses anonymous-safe contracts only:

- `/api/v1/public/markets/overview`
- `/api/v1/providers/ecb?capability=fx-reference-rates&symbol=EUR`

It separates TradingView display, provider-rights state and approved ECB observations; private workspace/data-plane APIs are not requested on the anonymous Market route.

### Live-market provider contract drift

The provider service/UI contract is now provider-specific:

- Binance intervals: `1m, 5m, 15m, 30m, 1h, 4h, 1d`
- Coinbase intervals: `1m, 5m, 15m, 1h, 6h, 1d`

The authenticated Market Command separates external display symbol/interval controls from governed provider symbol/interval controls. This prevents a future Coinbase authorization from receiving Binance-style `BTCUSDT` / `4h` parameters.

The Cloudflare compatibility route also includes the previously missing `asset` endpoint.

### Public Asset Rankings deterministic crypto demo

The production Asset Rankings route previously imported `demonstrationRows()` / deterministic OHLC and displayed fixed crypto market cap, volume, open interest, funding, liquidations and prices.

The public production route is being retired from that demo model. It now exposes:

- ranking-feed availability truth;
- provider-rights state;
- no fabricated ranking values when no ranking feed is authorized;
- real ECB reference coverage as reference data, not re-labeled as asset rankings;
- TradingView / CME / Forex Factory / ECB outbound research surfaces.

## GitHub Pages divergence

`main` / GitHub Pages is not currently the same production artifact as Cloudflare.

Audit findings:

- `main` was 305 commits behind the release branch and had 5 main-only commits at the audit point.
- `.github/workflows/pages-preview.yml` explicitly builds with `QELLY_STATIC_VISUAL_PREVIEW=true`.
- `scripts/build-pages-canonical-handoff.mjs` creates a canonical handoff/preview rather than the live terminal.

Do not force-reset `main`; preserve main-only work and converge history deliberately after PR #218 is stable.

Target GitHub architecture:

- same-generation public/read-only terminal UI as Cloudflare;
- canonical Cloudflare public API/provider contracts where CORS/security permits;
- authenticated/private workspace actions hand off to the Cloudflare origin unless a cross-origin session architecture is explicitly designed and proven;
- never weaken cookies, SameSite, CSRF or CORS merely to make GitHub Pages impersonate the canonical origin.

## Supabase security residual

Current security advisor items need context, not blanket fixes:

- `pg_net` is in `public` and used by production scheduling. Do not drop/recreate it directly in production without branch rehearsal.
- `qelly_market_data_snapshot` and `qelly_timeseries_history` are authenticated-callable `SECURITY DEFINER` read facades over RLS-hidden data. Treat them as intentional until a narrower safe design is proven; do not replace them with broad table reads.
- leaked-password protection is unavailable on the current Supabase Free plan; this is a plan capability gap, not an application-code defect.
- performance-advisor unused-index notices should not trigger mass index deletion on a young workload.

## API/runtime audit queue

Maintain an endpoint matrix covering production APIs with:

- public path;
- Pages function owner;
- authentication requirement;
- data/provider owner;
- env/secrets;
- truth mode;
- cache TTL/stale window;
- timeout/retry behavior;
- last-success/error telemetry;
- user-visible fallback;
- regression coverage.

Priority surfaces:

1. `/api/v1/live-markets/catalog|status|asset|candles|ticker`
2. public market overview + public provider endpoints
3. provider catalog/result layer
4. session/context/profile/workspace/preferences
5. readiness / health / stale catch-all routing
6. news/research/fundamentals/reference/macro
7. calculators/indicators requiring market inputs
8. notification/delivery
9. import/vault
10. observability/data-mesh/stream operations

## UI audit queue

Dedicated V6 workbenches already exist for account/session, calculator center/details and indicator library/details; do not rewrite their engines merely because screenshots look stale. Audit shell/CSS ownership and exact browser renders first.

Continue route-by-route through:

- auth login/register/recovery;
- account/profile/session/security;
- calculator/indicator/formula/saved calculation;
- asset rankings and public market;
- search/discovery/categories/venues/DEX/global charts/converter/news;
- asset intelligence/chart/fundamentals/filing/events/comparison;
- portfolio/research/watchlist/alerts/notifications;
- operations/evidence/theme routes;
- mobile 390×844, keyboard, reduced-motion and 200% zoom.

No route may be declared modernized merely because shared CSS touched it.

## Mandatory continuation order

1. Stabilize PR #218 on one frozen exact head.
2. Remove remaining production market-shaped fixture/simulated content route-by-route.
3. Run repository, Cloudflare production parity and public-runtime validators.
4. Run all 142 desktop/mobile route captures plus accessibility/responsive regression.
5. Inspect visual evidence manually for stale UI/fallback labels.
6. Merge #218 only if all exact-head gates pass.
7. Verify exact merge SHA on `https://qelly-intelligence.pages.dev`.
8. Verify anonymous Market startup has no HTTP 401 and no `SIMULATED REFERENCE DATA` shell label.
9. Sign in and verify UI preference/profile persistence; inspect Supabase logs for absence of `qelly_ui_preferences` 403.
10. Synchronize Supabase release identity to the merged release SHA.
11. Converge `main` / GitHub Pages while preserving main-only commits and session-security boundaries.
12. Re-run GitHub Pages/browser parity and document the final URLs and provider-rights limitations.

## Prohibited shortcuts

- Do not call simulated/deterministic market values live.
- Do not reintroduce fixed market observations just to make a screen look populated.
- Do not enable rights-blocked providers by bypassing licensing/redistribution gates.
- Do not broaden Supabase table grants to bypass RLS/facade design.
- Do not claim GitHub Pages and Cloudflare are equivalent until deployed artifacts are verified.
- Do not merge based on superseded workflow runs; evidence must correspond to the exact merge head.
- Do not mark UI complete from unit tests alone.
