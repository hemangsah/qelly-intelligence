# Qelly V9 Repair State

Last substantive repair session: 2026-08-18

This is the durable continuation point for Qelly terminal convergence. It contains no secrets or user PII. Always re-query current GitHub, Cloudflare, GitHub Pages and Supabase state before making a new production claim.

## Current production and active repair

- Repository: `hemangsah/qelly-intelligence`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev/`
- Public mirror: `https://hemangsah.github.io/qelly-intelligence/`
- Current verified production release SHA: `d2dcc90578b92075214318bba7f8e01881c0402f`
- PR `#224` merged: live-data terminal convergence and V8/V9 route repair.
- PR `#225` merged: production shell/formula residual simulated-vocabulary cleanup.
- PR `#226` merged: deterministic calculator/indicator truth semantics.
- PR `#227` merged: World Bank annual macro source state corrected from live to reference.
- Active repair branch: `repair/qelly-v9-timezone-canonicalization-20260818`
- Next PR: canonicalize legacy India timezone aliases in runtime and persistence.

## Verified production convergence at `d2dcc905...`

Post-merge verification established:

- Cloudflare `qelly-release.json` serves `d2dcc90578b92075214318bba7f8e01881c0402f`.
- GitHub Pages serves the same SHA; mirror workflow run `32123567804` and API base remains canonical Cloudflare.
- Supabase `qelly_release_identity` records `cloudflare:d2dcc90578b92075214318bba7f8e01881c0402f`.
- `/api/v1/market/network` reports the same release SHA.
- World Bank annual GDP source state is `reference_external`, with `observedAt:null` retained rather than inventing a precise annual timestamp.
- Hyperliquid and Alternative.me remain `live_external_reference` fast public observations.
- ECB remains governed delayed/reference data.
- `fabricatedFallback:false`; internal execution and custody remain disabled.
- Connected production states do not include `simulated`.

## Product truth contract

1. Never fabricate connected market values.
2. Upstream failure remains `STALE`, `UNAVAILABLE` or `ERROR`.
3. Technical reachability is not redistribution permission.
4. Execution and custody remain disabled unless separately implemented and proven.
5. External widgets/research links are display/research boundaries, not ingestion licenses.
6. Cloudflare is canonical; GitHub Pages mirrors the product and calls canonical APIs where needed.
7. Deterministic local formulas, calculators and indicators are analytical computation states, not simulated market-data states.
8. Slow macro/reference datasets must not be labelled as live market observations merely because their HTTP request succeeded.
9. User-facing timezone identifiers should use canonical current IANA names rather than legacy aliases.

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

The historical 17 August ECB timeout incident was resolved after healthy provider cache evidence was established. Open `qelly_data_quality_events` count and open `qelly_provider_incidents` count were both verified as zero. Runtime job backlog was also verified as zero.

## Supabase production state

- Project ref: `ssdgfgqnjlwzkgukzeef`
- Region: `us-east-1`
- Provider ingestion Edge Function: `qelly-provider-ingestion`
- Release identity sync Edge Function: `qelly-release-identity-sync`
- Scheduled release sync: hourly via Supabase cron/Vault-backed scheduler boundary.

Scheduler credentials remain in Supabase Vault and must never be printed into repository files, logs or chat output.

## Auth/security findings

- Cloudflare-origin Supabase sign-in/session flows are functioning.
- User/workspace data uses authenticated RLS storage where implemented.
- Provider/readiness/time-series base tables are deliberately not directly browser-readable.
- `qelly_market_data_snapshot` and `qelly_timeseries_history` remain reviewed authenticated `SECURITY DEFINER` boundaries because underlying governed tables are not browser-readable.

Outstanding platform advisories:

- leaked-password protection remains disabled; current connected management tooling has not exposed a safe setting mutation, so do not claim it is fixed;
- `pg_net` remains installed in `public`; relocation requires dependency-aware migration planning;
- the reviewed `SECURITY DEFINER` RPCs remain an explicit architectural exception until replaced with an equally safe boundary.

## Active timezone canonicalization repair

Production evidence before the repair:

- `qelly_profiles`: 2 rows stored as `Asia/Calcutta`, 7 rows stored as `UTC`.
- `auth.users.raw_user_meta_data`: 2 users stored as `Asia/Calcutta`, 4 as `UTC`, 3 with no timezone metadata.
- no legacy timezone rows were found in `qelly_theme_schedules` at the time of the audit.

Branch: `repair/qelly-v9-timezone-canonicalization-20260818`

Scope:

- add shared `functions/_lib/timezone.js` canonicalization/recognition helpers;
- map the legacy `Asia/Calcutta` alias to `Asia/Kolkata`;
- canonicalize timezone input during Qelly registration before Supabase auth metadata is persisted;
- canonicalize profile PATCH values and profile GET payloads;
- add a migration that updates the two legacy profile rows and matching auth metadata;
- add persistence triggers on `qelly_profiles` and `qelly_theme_schedules` so supported database writes cannot reintroduce the legacy alias;
- add regression tests covering runtime canonicalization and the persistence contract.

This repair must not alter UTC profiles, unrelated profile fields, workspace ownership, session state, market data, provider policy, formula/indicator mathematics or execution/custody boundaries.

After the PR merges, apply the migration through the Supabase migration tool, then verify zero remaining `Asia/Calcutta` profile/auth metadata rows and verify the deployed profile/runtime release identity.

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
11. record remaining limitations explicitly instead of labelling them complete.

## Continuation rule

If a future chat says “continue Qelly”, start from this file, then freshly query:

1. current release branch SHA and open repair PRs;
2. exact-head GitHub Actions status;
3. Cloudflare `qelly-release.json`, `/api/v1/config`, `/api/v1/market/network`;
4. GitHub Pages release identity;
5. Supabase release identity/provider/auth/security/data-quality/profile evidence;
6. Vercel project/deployment state if parity work is requested.

Never substitute historical screenshots or old conversation SHAs for current runtime evidence.
