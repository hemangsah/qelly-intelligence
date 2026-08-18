# Qelly V9 Repair State

Last substantive repair session: 2026-08-18

This is the durable continuation point for Qelly terminal convergence. It contains no secrets or user PII. It is deliberately **not** a deployment-identity authority: every continuation must freshly query GitHub, canonical Cloudflare, GitHub Pages and Supabase before making a current production claim.

## Current source topology and evidence model

- Repository: `hemangsah/qelly-intelligence`
- Release branch: `release/qelly-global-public-beta`
- Canonical runtime: `https://qelly-intelligence.pages.dev/`
- Public mirror: `https://hemangsah.github.io/qelly-intelligence/`
- Source checkpoint observed immediately before the explicit-email-capability repair: `46c0d2007810a1f69fe2edff58ee0b2f9d76e62b`
- Last independently verified canonical Cloudflare runtime checkpoint recorded during this session: `6bb72f35c5b1a2b0019beba19dab438410d388f3`
- That Cloudflare checkpoint reports build/release time `2026-08-18T12:44:49.619Z`; the scheduled Supabase release-identity probe recorded it at `2026-08-18T13:05:01.986085Z`.

Do **not** infer that the current GitHub release head is already deployed merely because it is merged. Do **not** infer that the last verified runtime checkpoint is still current merely because it is recorded here. Re-query both sides and compare exact SHAs.

This distinction is intentional: any repair or governance merge changes the release-branch SHA, so embedding a timeless field named “current verified production release SHA” would make this file self-stale by construction.

## Completed 2026-08-18 repair chain

PRs `#224` through `#231`, `#233`, `#235` and `#236` are merged into the release line. Duplicate repair PRs `#232` and `#234` were closed after zero-diff convergence checks. Stale non-draft PR `#198` was closed after proving its runtime retirement and stronger regression coverage were already in current release.

Key completed repairs:

- `#227` — World Bank annual macro truth corrected to `reference_external`.
- `#228` — India timezone aliases canonicalized across runtime and persistence.
- `#229` — residual simulated/mock semantics removed from the account local-profile surface.
- `#230` — profile/account cloud-sync availability made explicit and strict `=== true`; stored opt-in is retained while unavailable.
- `#231` — `cloud/status`, `sync/push` and `sync/pull` enforce the same canonical cloud-sync capability before synchronization-specific Supabase access; saved-calculation persistence remains independent.
- `#233` — obsolete live-verifier branch/SHA pinning removed and verification identity made dynamic/release-aware.
- `#235` — release verification governance consolidated: Prompt 2C remains the automatic release-push verifier; V2 and V1 are manual diagnostics; V2 uses shared convergence and current provider-rights semantics.
- `#236` — durable continuation state made evidence-relative so source checkpoints and independently observed deployment checkpoints are not conflated.

## Live-verification ownership

Automatic post-merge production verification has one canonical owner:

- `.github/workflows/prompt2c-public-beta.yml`
  - triggers on `release/qelly-global-public-beta` pushes;
  - derives expected identity from `${{ github.sha }}`;
  - calls `scripts/wait-for-cloudflare-runtime-convergence.mjs`;
  - requires stable convergence across release JSON, build info, browser config, API config, health and readiness;
  - validates governed provider-rights states;
  - validates the deployed browser/CSP boundary;
  - uploads exact-SHA live evidence.

Manual diagnostics:

- `qelly-live-production-verification-v2.yml` — manual release-branch diagnostic using the same shared Cloudflare convergence helper and canonical rights-gated Binance/Coinbase semantics.
- `qelly-live-production-verification.yml` — legacy manual release diagnostic.

Cloudflare exact-PR deployment evidence is independently consumed by `qelly-cloudflare-evidence-handoff.yml`, which accepts successful official `cloudflare-workers-and-pages` deployment evidence, resolves the exact current open PR head, rebuilds/validates it and captures the full screen/accessibility archive.

Historical fixed-preview/restoration workflows still target historical feature branches that remain present. They are not the current release verification owner and should not be treated as current production evidence without a separate retirement decision.

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
11. GitHub source identity and deployed runtime identity are separate facts until exact convergence is proven.
12. Dated readiness evidence cannot enable a capability; runtime availability and readiness proof are separate controls.

## Provider and operations state

Usable governed paths:

- Hyperliquid — fast public market observations.
- Alternative.me — public market/sentiment observations.
- ECB — governed delayed/reference FX data.
- World Bank — annual macro reference observations.

Rights-gated:

- Binance — commercial/redistribution rights remain unverified; activation remains blocked by `blocked_pending_redistribution_rights`.
- Coinbase — written end-user display/redistribution permission remains unverified; activation remains blocked by `blocked_pending_written_end_user_display_permission`.

Do not relabel Binance or Coinbase as internally live until explicit rights evidence exists.

Fresh connected Supabase operations evidence on 2026-08-18 established:

- open data-quality events: `0`;
- open provider incidents: `0`;
- nonterminal runtime jobs: `0`;
- ECB readiness checks: passing;
- six Binance/Coinbase readiness rows outside generic “pass/ready” labels are intentional governance blocks (`activation_allowed:false`), not operational provider failures.

## Supabase release identity and scheduler

- Project ref: `ssdgfgqnjlwzkgukzeef`
- Provider ingestion Edge Function: `qelly-provider-ingestion`
- Release identity sync Edge Function: `qelly-release-identity-sync`
- Release identity scheduler: minute `5` of every hour (`5 * * * *`) through the existing Vault-backed scheduler boundary.

The release-identity Edge Function fetches canonical Cloudflare `qelly-release.json`, validates release/site/capability truth and records the exact observed release. A ledger row can therefore lag a newly merged/deployed release until the next scheduler run; timestamp the evidence and do not interpret temporary ledger lag as deployment failure without checking the observation window.

## Supabase security / readiness state

Fresh 2026-08-18 security-advisor review still reports these unresolved warnings:

- leaked-password protection remains disabled; the connected management surface still exposes no safe hosted Auth-setting mutation;
- `pg_net` is reported in schema `public` and is non-relocatable in the inspected installation; do not attempt a naive `ALTER EXTENSION ... SET SCHEMA`;
- `qelly_market_data_snapshot` and `qelly_timeseries_history` remain reviewed authenticated `SECURITY DEFINER` read RPC boundaries because their governed source tables are not browser-readable.

Do not weaken RLS or rewrite Auth internals to silence these warnings. Performance `unused_index` findings remain informational without representative workload evidence.

## Email-delivery capability and readiness contract

Runtime availability is fail-closed and configuration-driven:

- frontend production artifact activation requires `QELLY_REQUIRE_PUBLIC_RUNTIME=true` and explicit `QELLY_ENABLE_AUTH_EMAIL_DELIVERY=true`;
- Pages Functions runtime availability also requires explicit `QELLY_ENABLE_AUTH_EMAIL_DELIVERY=true`;
- canonical hostname alone cannot enable registration/recovery;
- registration and recovery fail with `auth_email_delivery_unavailable` before any Supabase email request when the explicit flag is missing/false.

Readiness evidence is a separate control:

- privacy-preserving Supabase aggregate verification on 2026-08-18 found six confirmation-mail attempts after the previous canary and four accounts subsequently confirmed after their recorded `confirmation_sent_at`;
- the latest confirmed-after-mail observation was `2026-08-15T11:11:55.355034Z`;
- `AUTH_EMAIL_CANARY` records that timestamp with evidence method `confirmation_sent_at_then_email_confirmed_at`, `readinessEvidence:true`, and `capabilityAuthority:false`;
- readiness can use this explicitly dated production evidence only when the runtime email capability is also explicitly configured;
- the canary cannot turn the capability on and does not replace periodic refresh of deliverability evidence.

Do not persist recipient addresses, raw mail credentials or user identities merely to refresh this proof.

## Timezone canonicalization

Supabase migration: `20260818101413_qelly_timezone_canonicalization_v1`.

Last verified migration state:

- `qelly_profiles`: canonical `Asia/Kolkata` / `UTC`, zero `Asia/Calcutta`;
- `auth.users.raw_user_meta_data`: zero legacy `Asia/Calcutta` where timezone metadata is present;
- `qelly_theme_schedules`: zero legacy alias rows;
- profile and theme-schedule canonicalization triggers are installed;
- registration/profile runtime paths canonicalize the legacy alias before persistence/response.

Re-query counts before making a new current-row-count claim.

## Vercel boundary

Last connected Vercel checkpoint found zero Qelly projects. Treat that as a historical checkpoint, not a permanent fact: re-query Vercel before any parity claim. Never invent a Vercel URL merely because `vercel.json` exists.

## Durable open-risk queue

Do not encode an “active repair branch” here; that field becomes stale immediately after a successful merge. Resolve current work from GitHub at continuation time.

Known items that still require fresh evidence or external authorization before stronger claims:

- periodic refresh of end-to-end transactional-email confirmation/recovery evidence;
- leaked-password protection enablement through a supported Supabase Auth management surface;
- Binance redistribution rights and Coinbase written end-user display/redistribution permission;
- Vercel parity only if a real connected Qelly project is created and verified;
- retirement of historical feature-branch workflows only after their remaining draft/history use is intentionally closed.

## Release procedure

For every repair PR:

1. recover the exact current release base and exact PR head;
2. require exact-head success for repository diagnostics, V8 live-terminal acceptance, Cloudflare parity, GitHub mirror, Prompt 2C, corrective validation and complete all-screens evidence as applicable;
3. never merge a red, incomplete, superseded or behind head;
4. merge using an expected-head SHA guard;
5. re-query the release branch after merge;
6. prove canonical Cloudflare identity independently; do not substitute PR preview success for production deployment;
7. verify `/api/v1/config`, health/readiness and market/provider truth when the repair affects those surfaces;
8. verify GitHub Pages parity when applicable;
9. synchronize/verify Supabase release identity, accounting for the hourly scheduler observation window;
10. apply and verify any included Supabase migration only through the governed migration path;
11. rerun relevant advisors after DDL/security changes;
12. record remaining limitations explicitly.

## Continuation rule

If a future chat says “continue Qelly”, start from this file but treat every exact SHA and operational count as a timestamped checkpoint, not current truth. Freshly query:

1. release branch SHA, open non-draft repair PRs and mergeability;
2. exact-head GitHub Actions for the active repair;
3. canonical Cloudflare release/config/health/readiness/market-provider truth;
4. GitHub Pages release identity/parity;
5. Supabase release ledger, provider/readiness/incidents/data-quality/runtime jobs and security advisors;
6. Vercel only if parity/deployment work is relevant.

Never substitute historical screenshots, old conversation SHAs, PR preview deployments, or this file’s checkpoints for fresh current-runtime evidence.
