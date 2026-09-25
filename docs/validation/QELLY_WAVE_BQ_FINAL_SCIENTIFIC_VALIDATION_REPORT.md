# QELLY Wave BQ — Final Scientific Validation Report

Date: 2026-09-26  
Verified production base: `46dc910d766b0021361933b9acecc3b919bcd130`  
Scope: post-PR397 scientific validation / institutional Decision research master prompt

## Executive result

QELLY Decision Intelligence is engineering-validated as a reproducible, fail-closed research system, but it is **not empirically validated as a profitable or calibrated trading system**.

The decisive scientific limitation is simple: production currently contains **0 tracked Decision setups, 0 resolved setup outcomes and 0 setup-observation rows**. Therefore target-touch performance, realized R:R, regime quality, setup-expiry quality, NO TRADE outcome quality and component ablation cannot be claimed from production outcomes.

The correct final state is:

- engineering / runtime acceptance: **PASS**;
- target-touch empirical calibration: **UNCALIBRATED / BLOCKED_BY_SAMPLE**;
- realized R:R by regime: **BLOCKED_BY_SAMPLE**;
- model component predictive-value ablation: **BLOCKED_BY_SAMPLE**;
- scenario calibration: **MODEL OUTPUT / diagnostic-only for the independent default fixture**;
- external Supabase leaked-password protection: **MANUAL / unresolved warning**.

No result below converts missing evidence into a pass.

## 1. Data

Production ledger snapshot:

| Measure | Result |
| --- | ---: |
| Persisted setup rows | 0 |
| Resolved setups | 0 |
| Unresolved setups | 0 |
| Observation rows | 0 |
| Distinct observed setup IDs | 0 |

Because there are no rows, per-field missingness percentages are not meaningful. Empty history is classified as `NO_OBSERVED_DATA`, not as clean empirical coverage.

Wave AA / PR #398 added deterministic quality checks for duplicate setups, temporal corruption, future leakage, target ordering, excursion sanity and terminal-label mutation, plus database guards that prevent scientific-field mutation after resolution. These controls are ready for future observations; they do not create historical samples.

## 2. Calibration

### Real target-touch calibration

State: **UNCALIBRATED**.

- calibration-eligible resolved setup count: 0;
- minimum gate: 50;
- T1/T2/T3/T4 before invalidation: unavailable;
- invalidation-before-target: unavailable;
- walk-forward Brier/reliability for real setup outcomes: unavailable.

The target-touch engine remains correctly fail-closed: probability stays null unless each metric independently clears sample-size, chronological walk-forward, Brier, reliability and confidence-interval gates.

### Scenario calibration

Wave AW / PR #408 enforced non-overlapping outcome windows and preserved the 36-observation gate.

On the reproducible 520-candle BTC-like 15m / 4h fixture:

- independent sample: 25;
- minimum sample gate: 36;
- Brier score: 0.3508;
- skill score vs uniform baseline: -0.0525;
- reliability gap: 0.1872;
- state: `UNCALIBRATED`;
- diagnostic metrics only: true.

These are deterministic fixture diagnostics, **not production outcome performance**. Bull/base/bear values remain model scenario outputs and must not be described as empirically calibrated probabilities.

## 3. R:R science

Engineering coverage exists for:

- 1:1;
- 1:2;
- 1:3;
- 1:4;
- Auto;
- Custom.

The engine validates each target against forecast range, structural barriers, expected move and evidence eligibility. Auto ranks feasible targets rather than choosing the largest nominal R:R.

Production outcome conclusions:

| Mode | Structural/engineering coverage | Realized target-touch / return quality |
| --- | --- | --- |
| 1:1 | PASS | BLOCKED_BY_SAMPLE |
| 1:2 | PASS | BLOCKED_BY_SAMPLE |
| 1:3 | PASS | BLOCKED_BY_SAMPLE |
| 1:4 | PASS | BLOCKED_BY_SAMPLE |
| Auto | PASS | BLOCKED_BY_SAMPLE |
| Custom | PASS | BLOCKED_BY_SAMPLE |

Venue-specific execution cost is not connected to the public Decision path. Therefore gross R:R may be shown, but net R:R remains unavailable unless an explicit round-trip cost assumption exists. No spread/fee/slippage value is fabricated.

## 4. Regime quality

The ledger can preserve regime, volatility, structure, MTF, derivatives, liquidity, macro, cross-asset, event-risk, news and calibration context for tracked setups.

However, with N=0 resolved setups:

- trending quality: BLOCKED_BY_SAMPLE;
- ranging quality: BLOCKED_BY_SAMPLE;
- high/low-volatility quality: BLOCKED_BY_SAMPLE;
- transition/event-driven/liquidity-stress quality: BLOCKED_BY_SAMPLE;
- regime-specific target-touch/Brier/MFE/MAE/expiry/R:R: BLOCKED_BY_SAMPLE.

No eligibility threshold was changed on the basis of tiny or absent regime samples.

## 5. Model / component ablation

Wave AC cannot produce a scientifically meaningful FULL vs FULL-minus-one predictive comparison with zero production outcomes.

Therefore:

- predictive-value ranking of structure/trend/momentum/volatility/MTF/derivatives/liquidity/macro/cross-asset/event/news/calibration: BLOCKED_BY_SAMPLE;
- component removal based on empirical performance: NOT PERMITTED;
- useful/redundant evidence claims: NOT ESTABLISHED.

Engineering responsibilities are nevertheless decomposed and versioned. Data quality, evidence confidence, calibration, liquidity, derivatives, scenario state and target feasibility are not silently collapsed into one unexplained score.

## 6. Latency

### Before

Wave AL / PR #400 measured a cache-busted canonical-production baseline:

| Surface | N | p50 | p90 | p95 |
| --- | ---: | ---: | ---: | ---: |
| Decision | 20 | 7.96 s | 9.44 s | 10.03 s |
| Scanner | 10 | 6.85 s | 8.20 s | 8.27 s |

### Current bounded external sample

Read-only browser sample collected 2026-09-25 23:20–23:23 UTC:

| Surface | Success sample | p50 | p90 | p95 |
| --- | ---: | ---: | ---: | ---: |
| Decision | 20/20 HTTP 200 | 1.120 s | 1.333 s | 1.339 s |
| Scanner | 7 HTTP 200 | 2.104 s | 2.314 s | 2.318 s |

Decision percentile reduction vs the Wave AL baseline is approximately 85.9% / 85.9% / 86.7% at p50/p90/p95.

Scanner success-only percentile reduction is approximately 69.3% / 71.8% / 72.0%, but that comparison has a material caveat: the same paced 10-request scanner run produced 7×200, 2×503 and 1×429. The success-only scanner percentile is therefore **not** a reliability certification and must not hide the non-200 responses.

Formal Wave BN operational objectives remain sample-gated:
- Decision p95 <= 3000 ms at n>=20;
- scanner p95 <= 4500 ms at n>=20;
- provider/error/vitals objectives have their own denominators.

The current 20-request Decision sample clears the latency target. The current scanner sample does not meet the n>=20 certification denominator.

## 7. Reliability and chaos

### Provider / dependency failure handling

Wave BO / PR #418 validated:

- mandatory candle timeout: fail closed / structured 503;
- optional benchmark failure: unavailable, no substitute;
- derivatives/L2/funding failure: unavailable, no fabricated values;
- partial MTF failure: fulfilled observed frames only;
- news outage: bounded stale cache only and explicitly stale;
- macro failure: unavailable/context-only;
- database slowdown: bounded retryable timeout;
- scanner partial asset failure: failed asset excluded;
- TradingView timeout: explicit display fallback only.

No public chaos/debug switch was added.

### Route / chaos stability

Wave BP / PR #419 Browser E2E stress evidence passed:

- 20 representative stability scenarios, 0 failures;
- max DOMContentLoaded: 728 ms;
- max long task: 153 ms;
- >500 ms long tasks: 0;
- critical stalls: 0;
- max route transition: 258.4 ms;
- max DOM nodes: 1,564;
- max FCP: 960 ms;
- max LCP: 1,164 ms;
- max CLS: 0.00203;
- max INP observed: 248 ms;
- route-cycle state: passed;
- Decision-chaos state: passed;
- Decision requests observed in chaos probe: 25;
- full refreshes: 3;
- control changes: 20;
- idle/resume: passed;
- Decision chaos heap: 2,952,564 -> 3,144,388 bytes;
- Decision chaos DOM: 1,040 -> 1,042;
- event listeners: 202 -> 202;
- timers: 2 -> 1;
- iframes: 0 -> 0.

The original BP summary printed a misleading scanner-request count because a duplicate summary key overwrote the authoritative counter. PR #420 repaired that reporting defect. This report intentionally does not reuse the invalid overwritten scanner count.

### Browser / product gates

Wave AY / PR #421 exact head passed:
- focused/full tests;
- type/syntax;
- lint;
- secret scan;
- production and frontend builds;
- product validation;
- Public Runtime;
- Production Parity;
- Foundation Services;
- containers;
- Security Analysis;
- Browser E2E;
- 142-screen desktop/mobile capture;
- accessibility;
- responsive interaction checks;
- route/first-paint stability.

## 8. Reproducibility and provenance

Wave AJ/AK / PR #399 freezes enough bounded metadata to reconstruct a tracked setup:

RAW SOURCE -> NORMALIZED DATA -> QUANT STATE -> EVIDENCE -> REGIME -> SCENARIO -> QELLY VIEW -> SETUP -> TARGET/INVALIDATION -> OUTCOME.

Recorded versions include Decision, model, quant, calibration, scenario, trade-research, Evidence Graph and R:R contracts plus source family, evidence timestamp and input fingerprint.

Raw candles, raw news bodies, secrets and private free-form chat text are not persisted in that archive.

Wave AY adds a local structured Research Note derived from the same authoritative Decision snapshot; it adds no provider request, model, endpoint or persistence path.

## 9. Conditional waves

- Wave AZ portfolio-aware context: **NOT ACTIVATED**. No safe private portfolio input/model is required for the public Decision experience, so correlated exposure/concentration is not inferred.
- Wave BA real Decision alerts: **NOT ACTIVATED**. No continuous monitoring/delivery contract was proven for setup lifecycle transitions; the existing ledger is explicit tracking/re-observation, not a claim of live monitoring.
- Wave BB research history: **PARTIAL EXISTING CAPABILITY** through the explicit observed setup ledger. No separate free-form Decision-history store was added. With N=0 there is no historical outcome sample to render.
- Wave AR macro regime and Wave AT post-event surprise: **NOT CALLED AS EMPIRICAL CAUSAL FEATURES** because the required verified intraday macro/event-surprise feeds are not connected.
- Options/on-chain/liquidation: explicit unavailable boundaries remain in force.

## 10. Security

Wave BK / PR #414:
- moved privileged market-history implementations to the private schema;
- retained public SECURITY INVOKER wrappers;
- kept explicit authenticated ownership checks in privileged implementations;
- revoked broad PUBLIC/anon/service-role execute on exposed wrappers and granted authenticated narrowly;
- did not broaden governed table SELECT access or weaken RLS.

Decision/scanner public endpoints retain rate limiting and fail-closed provider handling. Repository security gates and CodeQL pass on exact tested heads.

Supabase security advisor currently reports one external warning:

- **Leaked Password Protection Disabled** — MANUAL / EXTERNAL.

This is a Supabase Auth setting, not repaired by inventing a repository-side substitute.

## 11. Master acceptance checklist

### Scientific

| Item | State |
| --- | --- |
| Outcome ledger quality verified | PASS — controls verified; current history empty |
| No future leakage | PASS — chronological/non-overlap guards |
| Target-touch calibration valid or explicitly uncalibrated | PASS AS UNCALIBRATED |
| Brier/reliability reported | PASS — diagnostic scenario fixture; target-touch unavailable |
| Scenario calibration reviewed | PASS AS UNCALIBRATED |
| R:R by regime reviewed | BLOCKED_BY_SAMPLE |
| Setup expiry measured | BLOCKED_BY_SAMPLE |
| NO TRADE quality measured | BLOCKED_BY_SAMPLE |
| Component ablation where sample permits | NOT APPLICABLE AT N=0 |
| Sample limits disclosed | PASS |

### Decision

Scanner, 1:1/1:2/1:3/1:4/Auto/Custom, entry, stop, invalidation, targets, lifecycle, MFE/MAE storage, What Changed, Evidence Graph, Chat grounding, provenance/versioning and data-quality decomposition are engineering-present and gate-covered. Outcome-dependent MFE/MAE conclusions remain unavailable at N=0.

### Performance

- Decision p50/p90/p95: measured;
- scanner p50/p90/p95: measured on a bounded success subset, certification denominator not met;
- route cycles: PASS;
- memory: PASS under BP thresholds;
- iframe lifecycle: PASS in Browser E2E/failure injection.

### Security

- RLS / governed RPC design: PASS;
- Edge/auth boundary tests: PASS;
- rate limits: PRESENT;
- repository secret exposure: PASS;
- leaked-password protection: MANUAL / EXTERNAL warning.

### Product

- desktop/mobile: PASS;
- accessibility/responsive: PASS;
- old-UI/duplicate-shell stability: PASS;
- dead-control/source hygiene waves: PASS;
- fake-data prohibition: PASS;
- public/private boundaries: PASS.

### Production

Production base `46dc910d766b0021361933b9acecc3b919bcd130` was:
- deployed successfully by Cloudflare Pages;
- externally verified by the Public Runtime browser/CSP gate;
- recorded by `public.qelly_release_identity`.

BQ itself is documentation/acceptance evidence only and must still pass the same exact-head release matrix before merge.

## 12. Final scientific conclusion

QELLY can now be evaluated as a governed research system without pretending that engineering completeness equals predictive validation.

What is established:
- reproducible/versioned Decision construction;
- no-future-leakage calibration mechanics;
- real-outcome ledger and calibration gates;
- structural R:R feasibility;
- fail-closed provider/dependency behavior;
- materially lower Decision latency in the current bounded sample;
- route/browser stability;
- explicit unavailable states;
- privacy-safe observability;
- research-note portability.

What is **not** established:
- profitable signals;
- real target-touch calibration;
- superior Auto/Custom R:R performance;
- regime-specific edge;
- predictive value of individual components;
- NO TRADE protective value on real outcomes;
- statistically certified scanner availability;
- causal macro/news/event explanations.

Those claims require real, clean, resolved setup history. Until that sample exists, QELLY should remain intentionally conservative and keep `UNCALIBRATED`, `NO TRADE`, `WAIT`, `UNAVAILABLE` and `BLOCKED_BY_SAMPLE` as valid first-class states.
