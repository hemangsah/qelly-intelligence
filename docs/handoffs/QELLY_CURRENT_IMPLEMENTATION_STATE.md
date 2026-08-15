# Qelly Intelligence — Current Implementation State

Updated: 2026-08-15
Purpose: durable cross-chat implementation handoff. Read this before continuing Qelly work.

## Identity and boundaries

Repository: `hemangsah/qelly-intelligence`
Release branch: `release/qelly-global-public-beta`
Production terminal: `https://qelly-intelligence.pages.dev`
Current release baseline for this design wave: `3b363d5865f7b29b7d2fa5847750ea233ab6e214`
Supabase project: `ssdgfgqnjlwzkgukzeef`

Qelly is an evidence-first, research-first, read-only financial intelligence terminal. Do not add trade execution, custody, wallet signing, private-key/recovery-phrase handling, withdrawals, transfers or money movement.

Do not mix Qelly with the separate Wix project.

## Design authority

The repository-native internal design source is now the Figma-equivalent implementation authority:

- `docs/design/QELLY_TERMINAL_DESIGN_SOURCE.md`
- `docs/design/qelly-terminal-tokens.json`
- `docs/design/QELLY_COMPONENT_LIBRARY.md`
- `docs/design/qelly-route-layouts.json`
- `docs/design/QELLY_DATA_PROVIDER_AND_EMBED_SURFACES.md`
- `docs/design/prototype/index.html`

Implementation must converge to these contracts rather than creating another synthetic reference overlay.

## Completed production repairs

### Authenticated self-delete
PR #190 merged. Authenticated RPC-based self-delete exists without exposing a Cloudflare service-role secret.
Remaining proof: fresh latest-release end-to-end canary — signup → confirmation → signin → self-delete → rejected re-login.

### Live Markets Pages/runtime parity
PR #191 merged and deployed. Cloudflare Pages now owns the `/api/v1/live-markets/*` runtime surface used by the frontend. Provider/right/fallback labels are explicit; the frontend must not claim blocked provider data is live.

### Supabase bootstrap request amplification
PR #192 merged and deployed. Config and browser-local layout preference paths no longer perform unnecessary profile/workspace bootstrap reads.

### Evidence-package auth truth
PR #193 fixed stale evidence text that incorrectly represented successful signup/confirmation as globally blocked.

### Real V5.3 route migrations
The former synthetic reference-overlay architecture was removed from functional ownership route-by-route.

PR #194 — Market.
PR #195 — Advanced Chart, Screener Lab.
PR #196 — Research Workspace, Portfolio Analytics, Watchlist, Saved Calculations, Calculator Detail, Decision Provenance.
PR #197 — Security Setup, Delivery Operations, Notification Center, About Qelly, Theme Lab.

Release `3b363d5865f7b29b7d2fa5847750ea233ab6e214` passed production Cloudflare convergence and fresh all-screen evidence: 142 desktop/mobile renders across 71 registered routes, with 0 capture failures and 0 console errors in that evidence run.

## Active hardening PR

PR #198 — `Retire obsolete V5.3 synthetic runtime overlay`
State at this handoff: open.
Head branch: `fix/qelly-retire-v53-synthetic-runtime-20260815`
Observed head SHA: `428b750b7885e9bfe5a8ef690301246fe50babef`
Purpose: remove the obsolete dynamic runtime import of `qelly-v53-lock-candidate-convergence.mjs` while preserving the historical/reference source and real route cleanup/harmonization.
First validation was red in the complete Node suite; isolate exact failing assertion, fix without re-enabling synthetic runtime, rerun both validators, merge only when green, then verify Cloudflare + all-screen evidence again.

## Route contract

Locked V5.3 canonical route count: 70.
Current registry also contains `qelly-verify`, explicitly V5.4, creating 71 registered routes.
Do not delete Qelly Verify blindly. Reconcile validation/evidence language so 70 remains the V5.3 contract and Qelly Verify is a versioned extension.

## Current data-provider truth

Repository provider policy currently:

- Binance quote/candles: adapter exists, production `enabled:false`; blocked pending redistribution-right verification.
- Coinbase quote/candles: adapter exists, production `enabled:false`; blocked pending written end-user display permission under current Qelly governance.
- ECB FX reference rates: enabled and attributed as delayed/reference, not live tradable FX.

This is why Live Markets can show explicit demonstration/simulated fallback even though provider-adapter code exists. Fix the provider rights/configuration path; never solve this by relabeling a fixture as live.

Next provider expansion candidates:
- TradingView official widgets for embedded charts/market/economic-calendar modules where provider-supported data level is surfaced truthfully.
- Coinbase technical live transport only after Qelly usage-right gate is deliberately satisfied.
- CoinGecko under a documented commercial/display license and attribution contract.
- FRED macro data only with API-key setup and series-level rights review.
- Forex Factory as canonical outbound/export integration by default; its current notices prohibit republication/redistribution without written consent.

## API/runtime audit queue

Create an endpoint matrix covering every production API with:
- public path
- Pages function owner
- authentication requirement
- data/provider owner
- required env/secrets
- truth mode
- cache TTL/stale window
- timeout/retry behavior
- last-success/error telemetry
- user-visible fallback
- regression test

Priority paths:
1. `/api/v1/live-markets/catalog|status|candles|ticker`
2. provider catalog/result layer
3. runtime config / checked-in `qelly-config.js` fallback versus deployed generated config
4. session/context/profile/workspace APIs
5. readiness and stale catch-all readiness branch
6. news/research/fundamentals/reference/macro surfaces
7. calculator/indicator market-input surfaces
8. notification/delivery APIs
9. import/vault APIs
10. observability/data-mesh/stream operations

## UI audit queue

Even after the 14 major synthetic-route migrations, audit all route families against the new internal design source:

- authentication/sign-in/register/recovery visual and error-state convergence
- post-sign-in profile/session modular UI
- calculator center/detail/saved calculations
- indicator library/detail
- formula library/detail
- search/discovery/category/venue pages
- asset/rankings/global charts
- news/research/filing/fundamentals
- portfolio attribution
- operations/evidence routes
- theme/persona consistency
- mobile 390×844 and 200% zoom
- keyboard/reduced-motion behavior

No route may be declared modernized merely because shared CSS touched it.

## External integration queue

Add official/compliant integrations as modular components, not uncontrolled iframes:
- TradingView official widget module(s)
- canonical market/provider/source links
- compliant macro/economic calendar source modules
- Forex Factory canonical calendar/export deep-link surface unless permissions change

Update CSP only for reviewed origins. Never bypass X-Frame-Options, CSP, anti-framing or provider terms.

## Auth/security residual

Supabase leaked-password protection remains disabled and is an active platform-hardening item.
Signup confirmation and subsequent sign-in have current successful evidence.
Password-recovery delivery still needs a fresh controlled canary.
Expired/reused confirmation-link UX needs explicit user-facing state coverage.

## Operational/parity residual

The deployed Cloudflare release must remain the canonical usable terminal. GitHub/source previews and evidence must identify the exact release SHA and must not diverge from the production build/runtime configuration.

The checked-in frontend runtime config may act as a static fallback while deployment rewrites/generates production values. Audit this path so source fallback cannot be mistaken for deployed truth.

A stale readiness branch exists in broader routing code even though a dedicated readiness endpoint supersedes it. Delegate/remove stale hard-coded readiness statements to prevent future routing/parity drift.

## Mandatory continuation loop

For every repair wave:

`FETCH CURRENT STATE → IDENTIFY ROOT CAUSE → IMPLEMENT REAL FIX → ADD/UPDATE REGRESSION COVERAGE → RUN BOTH PR VALIDATORS → MERGE WHEN GREEN → VERIFY EXACT MERGE SHA ON CLOUDFLARE → GENERATE/INSPECT DEPLOYED DESKTOP+MOBILE EVIDENCE → UPDATE THIS HANDOFF`

Do not report historical red runs as current blockers after a newer exact SHA is green.
Do not call simulated/deterministic values live.
Do not mark UI complete from unit tests alone.
Do not merge a provider until both technical and display/usage-right gates are satisfied.