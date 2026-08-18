# Qelly V9 Repair State

Last substantive repair session: 2026-08-18

This is the durable continuation point for Qelly terminal convergence. It contains no secrets or user PII. Always re-query current GitHub, Cloudflare, GitHub Pages and Supabase state before making a new production claim.

## Current production and active repair

- Repository: `hemangsah/qelly-intelligence`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev/`
- Public mirror: `https://hemangsah.github.io/qelly-intelligence/`
- Current verified production release SHA: `8247d805954ec38cca9ef4b98cceda587d17d335`
- PR `#224` merged: live-data terminal convergence and V8/V9 route repair.
- PR `#225` merged: production shell/formula residual simulated-vocabulary cleanup.
- PR `#226` merged: deterministic calculator/indicator truth semantics.
- PR `#227` merged: World Bank annual macro source state corrected from live to reference.
- PR `#228` merged: canonical India timezone identifiers across runtime and persistence.
- Active repair branch: `repair/qelly-v9-account-local-truth-semantics-20260818`
- Next PR scope: remove residual simulated/mock semantics from the account local-profile fixture while preserving explicit local-vs-cloud truth.

## Verified production convergence at `8247d805...`

Post-merge verification established:

- Cloudflare `qelly-release.json` serves `8247d805954ec38cca9ef4b98cceda587d17d335`.
- GitHub Pages serves the same SHA; mirror workflow run `32125589383` and API base remains canonical Cloudflare.
- Supabase `qelly_release_identity` records `cloudflare:8247d805954ec38cca9ef4b98cceda587d17d335`.
- `/api/v1/config` returns the same release in both top-level and runtime release fields and keeps `fabricatedMarketFallback:false`.
- `/api/v1/market/network` returns the same release SHA, World Bank `reference_external`, Hyperliquid and Alternative.me `live_external_reference`, `fabricatedFallback:false`, and `execution:false`.
- Connected production states do not include `simulated`.

## Timezone canonicalization completed

Supabase migration recorded as `20260818101413_qelly_timezone_canonicalization_v1`.

Verified post-migration state:

- `qelly_profiles`: 2 `Asia/Kolkata`, 7 `UTC`, zero `Asia/Calcutta`.
- `auth.users.raw_user_meta_data`: 2 `Asia/Kolkata`, 4 `UTC`, 3 without timezone metadata, zero `Asia/Calcutta`.
- `qelly_theme_schedules`: zero `Asia/Calcutta` rows.
- `qelly_profiles_timezone_canonical` trigger is installed.
- `qelly_theme_schedules_timezone_canonical` trigger is installed.
- registration and profile API paths canonicalize the legacy `Asia/Calcutta` alias to `Asia/Kolkata` before persistence/response.

## Product truth contract

1. Never fabricate connected market values.
2. Upstream failure remains `STALE`, `UNAVAILABLE` or `ERROR`.
3. Technical reachability is not redistribution permission.
4. Execution and custody remain disabled unless separately implemented and proven.
5. External widgets/research links are display/research boundaries, not ingestion licenses.
6. Cloudflare is canonical; GitHub Pages mirrors the product and calls canonical APIs where needed.
7. Deterministic local formulas, calculators and indicators are analytical computation states, not simulated market-data states.
8. Slow macro/reference datasets must not be labelled as live market observations merely because their HTTP request succeeded.
9. User-facing timezone identifiers use canonical current IANA names rather than legacy aliases.
10. Local fixture/persistence states must be named explicitly as local and must not reuse simulated market semantics.

## Provider and data-quality state

Approved/usable paths:

- Hyperliquid — fast public market observations.
- Alternative.me — public market/sentiment observations.
- ECB — governed delayed/reference FX data persisted through Supabase.
- World Bank — annual external macro reference observations.

Rights-gated providers:

- Binance — commercial/redistribution rights remain unverified.
- Coinbase — written end-user display/redistribution permission remains unverified.

Do not relabel Binance or Coinbase as internally live until explicit rights evidence exists in the provider registry.

The historical 17 August ECB timeout incident was resolved after healthy provider cache evidence was established. Open `qelly_data_quality_events`, open `qelly_provider_incidents`, and runtime-job backlog were verified as zero.

## Supabase production state and advisories

- Project ref: `ssdgfgqnjlwzkgukzeef`
- Region: `us-east-1`
- Provider ingestion Edge Function: `qelly-provider-ingestion`
- Release identity sync Edge Function: `qelly-release-identity-sync`
- Scheduled release sync: hourly via Supabase cron/Vault-backed scheduler boundary.

Scheduler credentials remain in Supabase Vault and must never be printed into repository files, logs or chat output.

Post-timezone-DDL security advisories are unchanged; the migration introduced no new advisory. Outstanding warnings remain:

- leaked-password protection is disabled; current connected management tooling has not exposed a safe setting mutation, so do not claim it is fixed;
- `pg_net` remains installed in `public`; relocation requires dependency-aware migration planning;
- `qelly_market_data_snapshot` and `qelly_timeseries_history` remain reviewed authenticated `SECURITY DEFINER` RPC boundaries because their governed source tables are not browser-readable. Do not blindly revoke or convert them without an equivalent safe boundary.

Performance advisor output currently contains only `unused_index` informational candidates. Do not drop indexes solely because they have not yet accumulated usage; evaluate workload and FK/query requirements first.

## Active account local-truth cleanup

Branch: `repair/qelly-v9-account-local-truth-semantics-20260818`

Confirmed residue in `apps/web/public/assets/routes/account-session.mjs`:

- local profile fixture used `q-status--simulated` despite being deterministic/local persistence rather than simulated market data;
- customer copy said unsupported controls were unavailable “rather than simulated”;
- security copy called unavailable controls “mock controls”.

Current branch changes:

- local profile badge uses neutral `cached` styling rather than simulated styling;
- profile badge exposes `data-truth-state="cloud-rls"` or `data-truth-state="local"` explicitly;
- customer copy describes unsupported controls as unavailable until production capability is proven;
- unavailable security controls are described as placeholder controls, not mocks;
- production-vocabulary regression coverage rejects simulated/mock semantics on the account surface.

This scope must not alter authenticated profile persistence, session behavior, timezone data, cloud sync, market/provider truth, calculations, or execution/custody boundaries.

## Vercel state

The connected Vercel team still has zero Qelly projects. Do not claim Vercel deployment parity or invent a Vercel terminal URL.

The repository contains `vercel.json`, but the connector bootstrap path has not successfully created a project. The current Vercel CSP also needs deliberate alignment for approved external display frames before TradingView parity can be claimed.

## Release procedure

For every repair PR:

1. recover the exact current PR head;
2. require exact-head success for repository diagnostics, V8 live-terminal acceptance, Cloudflare parity, GitHub mirror, Prompt 2C, corrective validation, browser acceptance where triggered, and complete all-screens evidence;
3. do not merge a red or incomplete head;
4. merge using an expected-head SHA guard;
5. verify the resulting release SHA directly on Cloudflare `qelly-release.json`;
6. verify `/api/v1/config` capability/data-state truth and no connected `simulated` state;
7. verify `/api/v1/market/network` exact SHA, no fabricated fallback, fast public source availability and truthful reference states;
8. verify GitHub Pages release identity equals the same SHA;
9. synchronize and verify Supabase release identity;
10. apply/verify any Supabase migration included in the repair;
11. rerun relevant Supabase advisories after DDL;
12. record remaining limitations explicitly instead of labelling them complete.

## Continuation rule

If a future chat says “continue Qelly”, start from this file, then freshly query:

1. current release branch SHA and open repair PRs;
2. exact-head GitHub Actions status;
3. Cloudflare `qelly-release.json`, `/api/v1/config`, `/api/v1/market/network`;
4. GitHub Pages release identity;
5. Supabase release identity/provider/auth/security/data-quality/profile evidence;
6. Vercel project/deployment state if parity work is requested.

Never substitute historical screenshots or old conversation SHAs for current runtime evidence.
