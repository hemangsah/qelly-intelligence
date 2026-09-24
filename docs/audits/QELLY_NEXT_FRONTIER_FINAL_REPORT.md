# QELLY Next-Frontier Final Acceptance Report — Wave ZB

Date: 2026-09-25
Status before ZB gates: **READY FOR EXACT-HEAD FINAL ACCEPTANCE**

## START

- Prompt baseline production SHA: `0fc22351c5fcf4541892954e273ef58e95691106`.
- Reconciled production at ZB start: `9f422f60a393e87285201abab12934acd18b4780`.
- PRs #385 through #396 were reconciled.
- No open PR existed when ZB final acceptance began.
- Canonical production and Supabase `qelly_release_identity` both reported `9f422f60a393e87285201abab12934acd18b4780`.

## WAVES

| Wave | PR | Tested head | Merge SHA | Purpose |
| --- | ---: | --- | --- | --- |
| Q | #385 | `d57d5ab3075ce48e83e88ad86aec567b45d4ed57` | `777c78761c29c1069f971efa3d2cf229902bb1e4` | Post-PR384 architecture and latency audit |
| R | #386 | `54491a408ddc581117de41463c7ea8794ce92bd3` | `d8ad79691e90a8ce9b0bed51323ba1f9e03151dc` | Find Trade Now 2.0 and structural R:R 2.0 |
| Header | #387 | `55e6e7821254ae074d48bd33a363dcd1094d2da6` | `e4f98207de06ed23a9103663fa47ded07479fd07` | Decision Header 2.0 completion |
| S | #388 | `9cbc56c0ce0baa16455fddbda00ad0b11b7fae61` | `18bae8fb5b2b651e733cf7629f0f3ef57aa95c56` | Observed setup lifecycle and outcome ledger |
| T | #389 | `a0c8bc74904793ac458b92cc3163bc8e27543e64` | `13ac110915f744fc98733d47be3bba9b2c86d1ab` | Real target-touch calibration gate |
| U | #390 | `2b9d122285ee7da96745706ce1c8005ef2d651d5` | `8f7066bdad8de3ae609cfc85205e7abd47f55110` | Market structure and L2 microstructure |
| V | #391 | `88dd6b379e8abd70140466792114e4d4aa83943b` | `d47ab7e64f95cd4fcfb661861d9dfcb118d0ce3a` | Derivatives 2.0 |
| W | #392 | `08abd819b222c026e0d39cda3101e513e3546bc6` | `a2f0fe7c9598f84b903268e17679e0710b0c9020` | Macro, cross-asset and event-risk boundaries |
| X | #393 | `91ac09a7685924bc2a1932cee18653cadb43b649` | `69d667cb2d1f5cf9c2c8ff55fef845668065e3b0` | Past/Present/Future, What Changed and Evidence Graph 2.0 |
| Y | #394 | `e43b4ba7090a85a6f48dc639c9ba596a1796cc49` | `2737c7690edced6d2765ebbe5f48a01971a1a976` | QELLY Chat Decision Copilot 2.0 |
| Z | #395 | `13beecd10a056834743758df522de82d390269c8` | `33e53cd1964035cdfe43a1c31b0ef9fdbdd157d6` | Whole-terminal coherence and classified cleanup |
| ZA | #396 | `c31956bb7e2a4f2fe506e08b72a98f5698e53f04` | `9f422f60a393e87285201abab12934acd18b4780` | Performance, embed and route hardening |

## DECISION

The authoritative Decision route remains `apps/web/public/assets/routes/decision-proven-graph.mjs`; the authoritative public orchestration remains `functions/api/v1/decision-proven-graph.js`.

Final accepted scope:
- governed Find Trade Now 2.0;
- 1:1 / 1:2 / 1:3 / 1:4 / Auto / Custom R:R with structural feasibility;
- evidence-qualified entry, stop, multiple invalidation classes, targets and expiry;
- persisted setup lifecycle/outcome observations;
- target-touch calibration only behind real-sample statistical gates;
- WAIT / NO TRADE remains first-class;
- MTF, market structure, real point-in-time L2 liquidity;
- derivatives with explicit historical-OI/basis/liquidation boundaries;
- official ECB daily FX macro reference only;
- same-venue cross-asset descriptive statistics only;
- scheduled event risk unavailable until a verified readable feed exists;
- news evidence without causal conversion;
- options/on-chain/liquidations explicitly available/unavailable rather than inferred;
- clean probability language and leakage-guarded analogs;
- Past / Present / Future 2.0, What Changed, Evidence Graph 2.0;
- Decision Copilot 2.0 grounded in the authoritative Decision receipt;
- Search → Dossier → Decision → Formula → Chat research-flow continuity.

## PERFORMANCE

Wave Q pre-change production point observations:
- terminal document ~486 ms;
- release identity ~461 ms;
- BTC 15m / 4h / Auto Decision API ~3,056 ms;
- six-asset 15m / 4h / Auto scanner ~2,556 ms.

Final production point observations taken during ZB:
- terminal document ~1,073 ms;
- release identity ~907 ms;
- BTC 15m / 4h / Auto Decision API ~4,158 ms;
- six-asset 15m / 4h / Auto scanner ~4,156 ms.

These API/document values are single point observations, not percentiles; the final points are not lower than the Wave Q points and no API speedup is claimed.

Wave ZA exact-head Browser E2E measured:
- 20 representative scenarios; 0 failed;
- max DOMContentLoaded 717 ms;
- max ready frame 644 ms;
- max FCP 940 ms;
- max LCP 1,060 ms;
- max CLS 0.00203;
- max INP 272 ms;
- max route transition 220.6 ms;
- max long task 162 ms;
- >500 ms long tasks: 0;
- critical stalls: 0;
- route-cycle status: passed;
- route-cycle DOM: 1,070 → 1,070;
- route-cycle heap: 2,862,596 → 3,977,800 bytes.

Existing web-vital and long-task thresholds were retained; no threshold was loosened.

## SECURITY

- All production public tables returned by the final audit have RLS enabled and at least one policy.
- Normal Edge Functions require JWT.
- `qelly-provider-ingestion` and `qelly-release-identity-sync` intentionally use `verify_jwt=false`, but both are POST-only and require long internal secret headers verified by SHA-256/constant-time comparison before service-role access.
- Supabase reports two authenticated SECURITY DEFINER warnings for `qelly_market_data_snapshot` and `qelly_timeseries_history`. These are intentionally authenticated, read-only governed-market RPCs; each checks `auth.uid()`, bounds inputs and uses an empty `search_path`.
- Recent Supabase logs showed zero error-level/error-like events in the audited window.
- Supabase Auth leaked-password protection remains disabled. This is documented as an external/manual project setting rather than changed automatically.
- 35 unused-index notices are informational; no index was removed without workload evidence.

## CLEANUP

Removed:
- one verified unreachable runtime lazy binding: `renderIntelligenceTerminal` in `app.js`.

Retained intentionally:
- `routes/intelligence-terminal.mjs` because acceptance tests own its fixture/guide contract;
- Decision compatibility adapter;
- shell compatibility;
- calculator/indicator/portfolio source compatibility;
- governed-discovery finalizer;
- public-runtime finalizer.

No mass deletion was performed.

## PRODUCTION

ZB starts from canonical production:
- `https://terminal.qellyintelligence.com/`;
- source revision `9f422f60a393e87285201abab12934acd18b4780`;
- `cloudflare-pages-public-runtime`;
- `supabase-cloudflare-facade`;
- Supabase release identity independently records the same source revision.

## COMPLETION CANDIDATE

- Decision next-frontier applicable checklist: **100% acceptance-covered**.
- Whole-terminal next-frontier applicable checklist: **100% acceptance-covered**.
- External/manual security hardening item: leaked-password protection.

This report is not the final deployment claim by itself. Final completion requires the Wave ZB exact-head gates, exact-head merge, Cloudflare convergence, canonical custom-domain verification and Supabase release-identity verification.
