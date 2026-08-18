# Qelly V9 Repair State

Last substantive repair session: 2026-08-18

This is the durable continuation point for Qelly terminal convergence. It contains no secrets or user PII. Re-query current GitHub, Cloudflare, GitHub Pages and Supabase state before making any fresh production claim.

## Current production and active repair

- Repository: `hemangsah/qelly-intelligence`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev/`
- Public mirror: `https://hemangsah.github.io/qelly-intelligence/`
- Current verified production release SHA: `dadc635b52be95b80b357cd5a78931818a8226ed`
- PRs `#224` through `#230` are merged.
- PR `#227`: World Bank annual macro truth corrected to `reference_external`.
- PR `#228`: India timezone aliases canonicalized across runtime and persistence.
- PR `#229`: residual simulated/mock semantics removed from the account local-profile surface.
- PR `#230`: profile/account cloud-sync availability made explicit and strict `=== true`; stored opt-in remains untouched while unavailable.
- Active repair branch: `repair/qelly-v9-cloudsync-backend-enforcement-20260818`
- Active scope: enforce the same canonical `cloudSync` capability on `cloud/status`, `sync/push`, and `sync/pull` while leaving saved-calculation persistence unchanged.

## Verified production convergence at `dadc635b...`

Post-merge verification established:

- the release branch resolves exactly to `dadc635b52be95b80b357cd5a78931818a8226ed`;
- the persistent Supabase production release identity is recorded on the same SHA;
- PR `#230` merged at that release SHA after its exact-head required gates were green;
- the release source contains the strict profile/account cloud-sync capability truth repair.

Re-query Cloudflare, `/api/v1/config`, `/api/v1/market/network`, GitHub Pages, and the Supabase release ledger before making any new deployment-convergence claim after the next merge.

## Timezone canonicalization completed

Supabase migration: `20260818101413_qelly_timezone_canonicalization_v1`.

Verified state:

- `qelly_profiles`: 2 `Asia/Kolkata`, 7 `UTC`, zero `Asia/Calcutta`.
- `auth.users.raw_user_meta_data`: 2 `Asia/Kolkata`, 4 `UTC`, 3 without timezone metadata, zero `Asia/Calcutta`.
- `qelly_theme_schedules`: zero legacy alias rows.
- `qelly_profiles_timezone_canonical` and `qelly_theme_schedules_timezone_canonical` triggers are installed.
- registration/profile runtime paths canonicalize the legacy alias before persistence/response.

## Product truth contract

1. Never fabricate connected market values.
2. Upstream failure remains `STALE`, `UNAVAILABLE` or `ERROR`.
3. Technical reachability is not redistribution permission.
4. Execution and custody remain disabled unless separately implemented and proven.
5. External widgets/research links are display/research boundaries, not ingestion licenses.
6. Cloudflare is canonical; GitHub Pages mirrors it and calls canonical APIs where required.
7. Deterministic/local analytical states are not simulated market-data states.
8. Slow macro/reference data must not be labelled live merely because an HTTP request succeeds.
9. User-facing timezone identifiers use canonical current IANA names.
10. Missing capability proof must fail closed; omission must not be interpreted as availability.

## Provider and operations state

Usable paths:

- Hyperliquid — fast public market observations.
- Alternative.me — public market/sentiment observations.
- ECB — governed delayed/reference FX data.
- World Bank — annual macro reference observations.

Rights-gated:

- Binance — commercial/redistribution rights remain unverified.
- Coinbase — written end-user display/redistribution permission remains unverified.

Do not relabel Binance or Coinbase as internally live until explicit rights evidence exists.

The historical ECB timeout incident is resolved. Open data-quality events, open provider incidents, and runtime-job backlog were verified as zero.

## Supabase security / readiness state

- Project ref: `ssdgfgqnjlwzkgukzeef`
- Provider ingestion Edge Function: `qelly-provider-ingestion`
- Release identity sync Edge Function: `qelly-release-identity-sync`
- Release sync runs hourly through a Vault-backed scheduler boundary.

Outstanding security advisories:

- leaked-password protection remains disabled; the connected management tool still exposes no safe Auth-setting mutation;
- `pg_net` version `0.20.4` is reported with extension schema `public` and `extrelocatable=false`; do not attempt a naive `ALTER EXTENSION ... SET SCHEMA`;
- `qelly_market_data_snapshot` and `qelly_timeseries_history` remain reviewed authenticated `SECURITY DEFINER` RPC boundaries because their governed source tables are not browser-readable.

Performance advisor output currently contains only `unused_index` informational candidates. Do not drop indexes solely because current usage counters are zero.

Readiness proof weakness still open:

- `functions/_lib/email-capability.js` uses a static `AUTH_EMAIL_CANARY` with `verifiedAt:'2026-08-14'` and can also accept an explicit production email-delivery flag;
- current Supabase Auth logs prove active `/user` and token/session operations from the canonical runtime, but the inspected log window does not itself provide a fresh end-to-end email-delivery proof;
- do not claim this static canary is equivalent to current transactional-email delivery evidence. A safe live/durable email canary needs a reliable non-PII evidence source or a dedicated controlled test-recipient workflow.

## Active cloud-sync backend enforcement repair

Branch: `repair/qelly-v9-cloudsync-backend-enforcement-20260818`

Confirmed defect on production `dadc635b...`:

- the profile/account surface now treats cloud synchronization as available only when the canonical runtime explicitly reports `cloudSync === true`;
- the authenticated backend handlers for `cloud/status`, `sync/push`, and `sync/pull` still execute without checking that capability;
- therefore a client can call synchronization routes even when the runtime capability is disabled.

Current branch changes:

- `functions/_lib/data.js` resolves the same effective public runtime used by the profile capability contract;
- the three supported synchronization routes require `runtime.capabilities.cloudSync === true` before any synchronization-specific Supabase read or write;
- disabled synchronization fails with HTTP 503 semantics, code `cloud_sync_unavailable`, and `retryable:false`;
- regression coverage proves all three synchronization routes fail before Supabase access when disabled;
- regression coverage also proves `saved-calculations` cloud persistence remains available when synchronization is disabled.

This repair must not alter saved-calculation CRUD behavior, stored calculation data, existing user opt-in values, profile/workspace RLS ownership, database schema/migrations, timezone data, market/provider truth, formulas/indicators, or execution/custody boundaries.

## Vercel state

The connected Vercel team still has zero Qelly projects. Do not claim Vercel deployment parity or invent a Vercel URL.

The repository contains `vercel.json`, but connector bootstrap has not created a project. Vercel CSP also requires deliberate external-frame alignment before TradingView parity can be claimed.

## Release procedure

For every repair PR:

1. recover the exact current PR head;
2. require exact-head success for repository diagnostics, V8 live-terminal acceptance, Cloudflare parity, GitHub mirror, Prompt 2C, corrective validation, browser acceptance where triggered, and complete all-screens evidence;
3. never merge a red or incomplete head;
4. merge using an expected-head SHA guard;
5. verify resulting release SHA directly on Cloudflare;
6. verify `/api/v1/config` and `/api/v1/market/network` truth;
7. verify GitHub Pages same SHA;
8. synchronize/verify Supabase release identity;
9. apply and verify any included Supabase migration through the migration API;
10. rerun relevant advisors after DDL;
11. record remaining limitations explicitly.

## Continuation rule

If a future chat says “continue Qelly”, start from this file, then freshly query:

1. release branch SHA and open repair PRs;
2. exact-head GitHub Actions status;
3. Cloudflare release/config/market-network;
4. GitHub Pages release identity;
5. Supabase release/provider/auth/security/data-quality/profile evidence;
6. Vercel state if parity work is requested.

Never substitute historical screenshots or old conversation SHAs for current runtime evidence.