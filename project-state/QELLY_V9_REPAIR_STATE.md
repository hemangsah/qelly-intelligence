# Qelly V9 Repair State

Last substantive repair session: 2026-08-18

This file is the durable continuation point for Qelly terminal convergence. It intentionally contains no secrets or user PII. Always re-query current GitHub/Cloudflare/Supabase state before making a fresh production claim.

## Current production release

- Repository: `hemangsah/qelly-intelligence`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev/`
- Public mirror: `https://hemangsah.github.io/qelly-intelligence/`
- Current verified production release SHA: `49142dd9a908f1591687d20300448c9e6edf4349`
- PR `#224` merged: live-data terminal convergence and V8/V9 route repair.
- PR `#225` merged: production shell/formula residual simulated-vocabulary cleanup.
- Active follow-up PR: `#226` — normalize deterministic calculator and indicator truth semantics.
- Active branch: `repair/qelly-v9-analytical-truth-semantics-20260818`

## Verified production convergence at `49142dd9...`

Direct runtime verification after PR #225 merge established:

- Cloudflare `qelly-release.json` serves `49142dd9a908f1591687d20300448c9e6edf4349`.
- GitHub Pages `qelly-release.json` serves the same SHA and uses Cloudflare as the canonical API base.
- Supabase `qelly_release_identity` records `cloudflare:49142dd9a908f1591687d20300448c9e6edf4349`.
- Cloudflare `/api/v1/config` returns the same release SHA, production auth/email/cloud/live-provider capabilities, and `fabricatedMarketFallback:false`.
- Connected production states do not include `simulated`.
- Cloudflare `/api/v1/market/network` returns the same release SHA, `fabricatedFallback:false`, `execution:false`, live Hyperliquid and Alternative.me observations, governed World Bank reference observations, and governed ECB reference rates.
- Latest post-merge network verification returned 30 ECB rate keys including EUR base, with explicit observation/ingestion timestamps.
- Deployed shell no longer contains the hidden `value="simulated"` state-selector option or a visible `Simulated` label.

## Product truth contract

1. Never fabricate connected market values.
2. Upstream failure remains `STALE`, `UNAVAILABLE` or `ERROR`.
3. Technical reachability is not redistribution permission.
4. Execution and custody remain disabled unless separately implemented and proven.
5. External widgets/research links are display/research boundaries, not ingestion licenses.
6. Cloudflare is canonical; GitHub Pages mirrors the product and calls canonical APIs where required.
7. Deterministic local formulas/indicators/calculators are analytical computation states, not simulated market-data states.

## Provider state

### Approved / usable paths

- Hyperliquid — public fast market observations through the Cloudflare market-network owner.
- Alternative.me — public market/sentiment observations through the Cloudflare market-network owner.
- ECB — governed delayed/reference FX data persisted through Supabase.
- World Bank — public macro reference observations through the Cloudflare market-network owner.

### Rights-gated providers

- Binance — commercial/redistribution rights remain unverified in the provider registry.
- Coinbase — written end-user display/redistribution permission remains unverified.

Do not relabel Binance or Coinbase as internally live until explicit rights evidence exists in the provider registry.

## Research/display links

The governed research dock includes TradingView, Forex Factory, ECB, World Bank, DefiLlama, CoinGlass, Hypurrscan, CoinMarketCap, CoinPaprika and other explicitly outbound/display destinations.

TradingView is display-only. Widget values are not silently ingested as Qelly analytics inputs. If embedding fails, use a clean external-link fallback rather than a fabricated chart.

## Supabase production state

- Project ref: `ssdgfgqnjlwzkgukzeef`
- Region: `us-east-1`
- Provider ingestion Edge Function: `qelly-provider-ingestion`
- Current repaired ingestion version from this repair sequence: v6
- Release identity sync Edge Function: `qelly-release-identity-sync`

ECB ingestion policy:

1. reuse fresh governed cache;
2. after historical backfill, prefer the small official ECB daily XML;
3. fall back to the official 90-day XML;
4. retain explicitly stale governed cache within `stale_until` if both official sources fail;
5. never fabricate values;
6. keep the custom internal ingestion-key authorization boundary.

Scheduled jobs include:

- `qelly-ecb-provider-ingestion` — working-day provider refresh;
- `qelly-release-identity-sync` — hourly release-ledger synchronization.

Scheduler credentials remain in Supabase Vault and must never be printed into repo files, logs or chat output.

## Auth/security findings

- Cloudflare-origin Supabase sign-in/session flows are functioning; verified `/user` and token-refresh traffic returned HTTP 200.
- User/workspace data uses authenticated RLS storage where implemented.
- Provider/readiness/time-series base tables are deliberately not directly browser-readable.
- `qelly_market_data_snapshot` and `qelly_timeseries_history` are reviewed authenticated `SECURITY DEFINER` RPC boundaries because underlying governed tables are not browser-readable. Do not blindly revoke authenticated execute or switch them to invoker semantics without an equivalent safe data boundary.

Outstanding Supabase platform advisories:

- leaked-password protection remains disabled; current connected management tooling has not exposed a safe setting mutation, so do not claim it is fixed;
- `pg_net` remains installed in `public`; relocation requires dependency-aware migration planning;
- the reviewed `SECURITY DEFINER` RPCs remain an explicit architectural exception until replaced with an equally safe boundary.

## Completed CI repair

The V8 acceptance workflow previously leaked production `QELLY_*` variables into repository tests. Repository tests now run in a clean environment and production capability variables are scoped to the production frontend build. Do not revert this separation.

## V9 design lock

Repository implementation authority:

`docs/design/QELLY_V9_TERMINAL_DESIGN_LOCK.md`

Primary convergence stylesheet:

`apps/web/public/assets/qelly-production-v9-route-convergence.css`

External design artifacts created during the repair session also exist as a PDF design lock and self-contained HTML design board, but the repository design lock is the durable implementation authority.

## PR #226 active scope

PR `#226` starts from verified production release `49142dd9a908f1591687d20300448c9e6edf4349` and removes the remaining analytical misuse of simulated-state classes:

- `calculator-detail.mjs` now uses explicit `data-truth-state="deterministic"` for the local computation boundary and `data-truth-state="local"` for local results;
- `indicator-detail.mjs` uses the same explicit deterministic/local metadata;
- neither route should retain `is-simulated` or `q-status--simulated` for deterministic/local computation;
- `tests/pages-preview-truth-contract.test.mjs` and `tests/qelly-v9-production-vocabulary.test.mjs` lock this distinction.

This scope must not alter formula mathematics, indicator mathematics, provider data, market values, execution/custody state, or genuine degraded/test fixtures.

The active PR head must be re-queried after this state-file commit; do not use an earlier SHA from this file to merge.

## Vercel state

The connected Vercel team `hemangsah's projects` still has zero projects. Do not claim Vercel deployment parity or invent a Vercel terminal URL.

The repository does contain `vercel.json` with the frontend build contract, but a direct connector bootstrap attempt did not create a project because the exposed deployment action could not resolve the required project/file payload. This is a tooling/bootstrap gap, not a successful deployment.

Important future Vercel parity issue: the current Vercel CSP uses `default-src 'self'` and does not explicitly permit external frames. If TradingView or another approved display widget is expected on Vercel, the Vercel CSP must be deliberately aligned with the canonical display boundary before claiming parity.

## Release procedure

For every repair PR:

1. recover the exact current PR head;
2. require exact-head success for repository diagnostics, V8 live-terminal acceptance, Cloudflare parity, GitHub mirror, Prompt 2C, corrective validation, browser acceptance where triggered, and complete all-screens evidence;
3. do not merge a red/incomplete head;
4. merge using an expected-head SHA guard;
5. verify the resulting release SHA directly on Cloudflare `qelly-release.json`;
6. verify `/api/v1/config` capability/data-state truth and no connected `simulated` state;
7. verify `/api/v1/market/network` exact SHA, no fabricated fallback, at least one fast public source and governed ECB reference rows;
8. verify GitHub Pages release identity equals the same SHA;
9. synchronize/verify Supabase release identity;
10. record remaining limitations explicitly instead of labelling them complete.

## Continuation rule

If a future chat says “continue Qelly”, start from this file, then freshly query:

1. current release branch SHA and open repair PRs;
2. exact-head GitHub Actions status;
3. Cloudflare `qelly-release.json`, `/api/v1/config`, `/api/v1/market/network`;
4. GitHub Pages release identity;
5. Supabase release identity/provider/auth/security evidence;
6. Vercel project/deployment state if parity work is requested.

Never substitute historical screenshots or old conversation SHAs for current runtime evidence.
