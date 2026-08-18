# Qelly V9 Repair State

Last substantive repair session: 2026-08-18

This document is the durable continuation point for Qelly terminal convergence. It intentionally contains no secrets or user PII.

## Current release and active cleanup

- Repository: `hemangsah/qelly-intelligence`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev/`
- Public mirror: `https://hemangsah.github.io/qelly-intelligence/`
- PR `#224` — merged successfully on 2026-08-18.
- Production merge SHA from PR `#224`: `336c77ada917839ef42387928f4f48090a44dcdc`.
- Active follow-up PR: `#225` — Remove residual simulated vocabulary from production UI.
- Active cleanup branch: `repair/qelly-v9-postmerge-cleanup-20260818`.

Always recover the current exact PR head and current production release from GitHub/Cloudflare before making a new claim about CI or deployment. Historical SHAs in this document are evidence, not permission to skip a fresh check.

## Verified production convergence after PR #224

The following were verified directly after merge rather than inferred from CI alone:

- Cloudflare `qelly-release.json` returned release SHA `336c77ada917839ef42387928f4f48090a44dcdc`.
- Cloudflare runtime reported authentication, email delivery, cloud sync, live providers and protected writes enabled.
- `/api/v1/config` returned the same release SHA and `fabricatedMarketFallback:false`; the connected production state vocabulary did not contain `simulated`.
- `/api/v1/market/network` returned the same release SHA, `fabricatedFallback:false`, `execution:false`, `custody:false`, fresh public observations and governed ECB reference data.
- GitHub Pages `qelly-release.json` returned the same release SHA and uses the Cloudflare canonical API base for live provider data.
- Supabase `qelly_release_identity` was explicitly synchronized and records `cloudflare:336c77ada917839ef42387928f4f48090a44dcdc`.

## Product truth contract

1. Never fabricate a market value in connected production.
2. Upstream failure remains `STALE`, `UNAVAILABLE` or `ERROR`.
3. A technically reachable provider is not automatically permitted for internal redistribution.
4. Execution and custody remain disabled unless independently implemented and proven.
5. External widgets and research links are a display/research boundary, not an ingestion license.
6. Cloudflare is canonical; GitHub Pages mirrors the product and calls canonical APIs where needed.
7. Deterministic analytical tools are not simulated market data. Their UI should say deterministic/local, not imply a simulated market state.

## Provider state

### Approved / usable paths

- Hyperliquid — public fast market observations through the Cloudflare market-network owner.
- Alternative.me — public market/sentiment observations through the Cloudflare market-network owner.
- ECB — governed delayed/reference FX data persisted through Supabase. Latest post-merge verification exposed 29 reference rates with explicit observation and ingestion timestamps.
- World Bank — public macro reference observations through the Cloudflare market-network owner.

### Rights-gated providers

- Binance — registry remains in verification with commercial/redistribution rights unverified.
- Coinbase — registry remains in verification with written end-user display/redistribution permission unverified.

Do not relabel these providers as internally live until explicit rights evidence is recorded in the provider registry. Reachability is not redistribution permission.

## Research/display links

The market-network owner includes professional research destinations such as TradingView, Forex Factory, ECB, World Bank, DefiLlama, CoinGlass, Hypurrscan and market-reference sites. These should appear in contextually relevant market/research surfaces, not be spammed across account/auth pages.

TradingView is display-only. If the widget fails or embedding is blocked, render a clean direct-link fallback; do not substitute a chart or silently ingest widget values.

## CI repair completed in PR #224

The V8 acceptance workflow previously applied production `QELLY_*` environment variables to the entire job, including repository tests. That made `npm test` fail while the same exact SHA passed the repository diagnostic workflow.

The workflow now runs repository tests in a clean environment and applies production capability variables only to the production frontend build. Do not revert this separation.

## PR #225 cleanup state

PR `#225` removes residual presentation vocabulary that could reintroduce a fake production state:

- removes the hidden legacy `Simulated` option from `apps/web/public/index.html`,
- changes formula-detail deterministic presentation away from `is-simulated` / `q-status--simulated`,
- adds `tests/qelly-v9-production-vocabulary.test.mjs`,
- updates the static-preview truth contract so formula methodology is explicitly deterministic and non-simulated.

The first PR #225 exact-head run failed because `tests/pages-preview-truth-contract.test.mjs` still required the obsolete simulated CSS marker. That test contract was corrected rather than restoring the stale production semantics. Re-query the current exact-head checks before merging.

Indicator/calculator local deterministic sample styling still contains legacy `q-status--simulated` class names in source. Their visible labels are deterministic/local rather than simulated market values, but the class vocabulary should be normalized in a later controlled cleanup if it can be changed without destabilizing route styling/tests.

## Supabase production state

- Project ref: `ssdgfgqnjlwzkgukzeef`
- Region: `us-east-1`
- Provider ingestion Edge Function: `qelly-provider-ingestion`
- Deployed function version at this handoff: `6`
- Release identity sync Edge Function: `qelly-release-identity-sync`

The ECB ingestion repair is persisted both in Supabase and repository source at:

`supabase/functions/qelly-provider-ingestion/index.ts`

Behavior:

1. Reuse fresh governed cache.
2. After historical backfill, prefer the small official ECB daily XML for routine refresh.
3. Fall back to the official 90-day XML if daily retrieval fails.
4. If both official sources fail but the last valid cache remains inside `stale_until`, return explicitly stale governed data instead of a 502 or fabricated value.
5. Return unavailable/upstream failure only when no valid source and no valid stale cache remain.
6. Keep the existing custom `x-qelly-ingestion-key` authorization boundary; do not disable it to trigger a refresh manually.

Scheduled jobs currently include:

- `qelly-ecb-provider-ingestion` — working days with a 30-second bounded network timeout.
- `qelly-release-identity-sync` — hourly release-ledger synchronization.

Scheduler credentials live in Supabase Vault. Never print decrypted secret values into logs, repo files or chat output.

## Supabase auth and security findings

- Cloudflare-origin sign-in/session traffic is functioning; authenticated `/user` and token-refresh requests returned HTTP 200 during verification.
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
- deterministic analytical presentation without presenting it as live market data,
- larger readable typography, touch-sized controls and responsive stacking,
- technical IDs moved behind disclosure,
- legacy micro-density reduced on customer routes.

Existing V8 route repairs still own saved calculations, research evidence, theme personas, calculator/indicator KPI strips, dark controls and TradingView failure state.

External design artifacts created during the repair session also exist as a PDF design lock and self-contained HTML design board, but the repository document above is the durable implementation authority.

## Regression tests

`tests/qelly-v8-live-terminal-convergence.test.mjs` locks:

- no simulated connected market state,
- no fabricated market fallback,
- Cloudflare + GitHub live-market acceptance,
- TradingView failure without fabricated charting,
- V9 convergence CSS/runtime loading,
- customer classification of detail routes,
- ECB daily-first/history-fallback/stale-preservation behavior.

`tests/qelly-v9-production-vocabulary.test.mjs` locks the post-merge production shell/formula vocabulary.

## Vercel state

The connected Vercel team `hemangsah's projects` currently has no projects. Do not claim Vercel deployment parity or invent a Vercel terminal URL.

A direct deployment attempt through the connected Vercel tool did not create anything because the exposed deployment action could not resolve its required project/file payload from the current connector context. Treat this as a tooling/bootstrap gap, not a successful deployment. A future Vercel deployment should be created deliberately from the repository/build contract and then added to release parity tests.

## Release procedure for current/future PRs

1. Recover the exact current PR head.
2. Require successful exact-head runs for at least:
   - Qelly V8 Live Terminal Acceptance,
   - Qelly Repository Test Diagnostics,
   - Qelly Cloudflare Production Parity,
   - Qelly Corrective Branch Validation,
   - Qelly Prompt 2C Public Runtime,
   - Qelly GitHub Pages Public Mirror,
   - Qelly Complete All-Screens Evidence.
3. Do not merge a red or incomplete exact head.
4. Merge using an expected-head SHA guard.
5. After merge, verify the resulting release SHA on canonical Cloudflare runtime and GitHub mirror.
6. Verify `/api/v1/market/network` has `fabricatedFallback:false`, at least one fast public source, governed ECB reference rows and no connected `simulated` state.
7. Verify `/api/v1/config` runtime capability truth and auth/email/cloud state.
8. Verify auth/profile and formula/calculator/indicator customer routes visually on desktop/mobile evidence.
9. Synchronize or verify the Supabase release identity ledger.
10. Record remaining platform limitations explicitly instead of labelling them complete.

## Continuation rule

If a future chat is asked to "continue Qelly", start from this file, then re-query:

1. the current release branch SHA and any open repair PR,
2. exact-head GitHub Actions status,
3. canonical Cloudflare `qelly-release.json`, `/api/v1/config` and `/api/v1/market/network`,
4. GitHub Pages release identity,
5. Supabase release identity/provider/auth/security evidence,
6. Vercel project/deployment state if parity work is requested.

Never substitute historical screenshots or old conversation SHAs for current runtime evidence.
