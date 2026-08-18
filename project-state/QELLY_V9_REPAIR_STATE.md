# Qelly V9 Repair State

Last substantive repair session: 2026-08-18

This file is the durable continuation point for Qelly terminal convergence. It contains no secrets or user PII. Always re-query current GitHub, Cloudflare, GitHub Pages and Supabase state before making a new production claim.

## Current production and active repair

- Repository: `hemangsah/qelly-intelligence`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev/`
- Public mirror: `https://hemangsah.github.io/qelly-intelligence/`
- Current verified production release SHA: `a1e9a56ef0c51a6ae67ba89549d53236b07cd424`
- PR `#224` merged: live-data terminal convergence and V8/V9 route repair.
- PR `#225` merged: production shell/formula residual simulated-vocabulary cleanup.
- PR `#226` merged: deterministic calculator/indicator truth semantics.
- Active repair branch: `repair/qelly-v9-world-bank-reference-truth-20260818`
- Next PR should correct World Bank annual macro API truth from a live state to an explicit external reference state.

## Verified production convergence at `a1e9a56e...`

Direct runtime verification after PR #226 established:

- Cloudflare `qelly-release.json` serves `a1e9a56ef0c51a6ae67ba89549d53236b07cd424`.
- GitHub Pages serves the same SHA and uses Cloudflare as the canonical API base.
- Supabase `qelly_release_identity` records `cloudflare:a1e9a56ef0c51a6ae67ba89549d53236b07cd424`.
- Cloudflare `/api/v1/config` returns the same release SHA with production authentication, email delivery, cloud sync, live-provider and protected-write capability truth.
- `fabricatedMarketFallback` is false and connected production states do not include `simulated`.
- Cloudflare `/api/v1/market/network` returns the same release SHA, `fabricatedFallback:false`, `execution:false`, fresh Hyperliquid and Alternative.me observations and governed ECB reference data.
- Latest verification returned 30 ECB rate keys including the EUR base.
- Deployed shell contains neither the old hidden `value="simulated"` state option nor a visible `Simulated` label.
- Calculator and indicator customer routes use explicit deterministic/local truth semantics rather than simulated market-state classes.

## Product truth contract

1. Never fabricate connected market values.
2. Upstream failure remains `STALE`, `UNAVAILABLE` or `ERROR`.
3. Technical reachability is not redistribution permission.
4. Execution and custody remain disabled unless separately implemented and proven.
5. External widgets and research links are display/research boundaries, not ingestion licenses.
6. Cloudflare is canonical; GitHub Pages mirrors the product and calls canonical APIs where needed.
7. Deterministic local formulas, calculators and indicators are analytical computation states, not simulated market-data states.
8. Slow macro/reference datasets must not be labelled as live market observations merely because their HTTP request succeeded.

## Provider and source state

### Fast public observations

- Hyperliquid — public fast market observations through the Cloudflare market-network owner.
- Alternative.me — public market/sentiment observations; ticker is approximately five-minute reference data and fear-and-greed is daily.

### Governed/reference observations

- ECB — governed delayed/reference FX data persisted through Supabase.
- World Bank — annual macro reference observations through the Cloudflare market-network owner. Production `a1e9...` still reports the raw API source state as `live_external_reference`; this is a semantic defect because the payload itself declares annual macro reference data and `observedAt` is null. The active repair changes the raw source state to `reference_external` without inventing a precise observation timestamp.

### Rights-gated providers

- Binance — commercial/redistribution rights remain unverified in the provider registry.
- Coinbase — written end-user display/redistribution permission remains unverified.

Do not relabel Binance or Coinbase as internally live until explicit rights evidence exists in the provider registry.

## Research/display links

The governed research dock includes TradingView, Forex Factory, ECB, World Bank, DefiLlama, CoinGlass, Hypurrscan, CoinMarketCap, CoinPaprika and other explicitly outbound/display destinations.

TradingView is display-only. Widget values are not silently ingested as Qelly analytics inputs. If embedding fails, render a clean external-link fallback rather than a fabricated chart.

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

Current ECB cache evidence from this repair session:

- observation date: `2026-08-17`
- ingestion time: `2026-08-18 07:01:41.509+00`
- cache expiry: `2026-08-19 19:01:41.17+00`
- truth state: `delayed_provider`

The historical 17 August ECB 90-day XML timeout data-quality event was resolved after the resilient ingestion path and healthy cache were verified. Open `qelly_data_quality_events` count was verified as zero, and there were no open `qelly_provider_incidents`. ECB `current_availability` and `freshness` readiness checks were refreshed to pass with current cache evidence.

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

External design artifacts from the repair session also exist as a PDF design lock and self-contained HTML design board, but the repository design lock is the durable implementation authority.

## Active World Bank reference-truth repair

Branch: `repair/qelly-v9-world-bank-reference-truth-20260818`

Scope:

- change the generic successful public-source helper so a source may provide an explicit state without changing the default fast-source state;
- return World Bank annual GDP data as `reference_external`, not `live_external_reference`;
- preserve `observedAt:null` because a year such as 2025 is not a precise observation timestamp;
- preserve World Bank attribution, annual cadence and its explicit statement that the data is not real-time market data;
- add `tests/qelly-v9-market-network-truth.test.mjs` to execute the World Bank source function against a controlled response and reject any live classification.

This scope must not change the World Bank values, Hyperliquid/Alternative.me fast-source states, ECB data, execution/custody state or provider-rights policy.

## Vercel state

The connected Vercel team `hemangsah's projects` still has zero projects. Do not claim Vercel deployment parity or invent a Vercel terminal URL.

The repository contains `vercel.json` with the frontend build contract, but a direct connector bootstrap attempt did not create a project because the exposed deployment action could not resolve the required project/file payload. This is a tooling/bootstrap gap, not a successful deployment.

Important future Vercel parity issue: the current Vercel CSP uses `default-src 'self'` and does not explicitly permit external frames. If TradingView or another approved display widget is expected on Vercel, the Vercel CSP must be deliberately aligned with the canonical display boundary before claiming parity.

## Release procedure

For every repair PR:

1. recover the exact current PR head;
2. require exact-head success for repository diagnostics, V8 live-terminal acceptance, Cloudflare parity, GitHub mirror, Prompt 2C, corrective validation, browser acceptance where triggered, and complete all-screens evidence;
3. do not merge a red or incomplete head;
4. merge using an expected-head SHA guard;
5. verify the resulting release SHA directly on Cloudflare `qelly-release.json`;
6. verify `/api/v1/config` capability/data-state truth and no connected `simulated` state;
7. verify `/api/v1/market/network` exact SHA, no fabricated fallback, at least one fast public source and governed/reference sources with truthful cadence/state;
8. verify GitHub Pages release identity equals the same SHA;
9. synchronize and verify Supabase release identity;
10. record remaining limitations explicitly instead of labelling them complete.

For the active World Bank repair, post-merge acceptance must additionally verify `sources['world-bank'].state === 'reference_external'` and must reject a state beginning with `live`.

## Continuation rule

If a future chat says “continue Qelly”, start from this file, then freshly query:

1. current release branch SHA and open repair PRs;
2. exact-head GitHub Actions status;
3. Cloudflare `qelly-release.json`, `/api/v1/config`, `/api/v1/market/network`;
4. GitHub Pages release identity;
5. Supabase release identity/provider/auth/security/data-quality evidence;
6. Vercel project/deployment state if parity work is requested.

Never substitute historical screenshots or old conversation SHAs for current runtime evidence.
