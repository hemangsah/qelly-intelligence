# QELLY Wave CL — Final Production Acceptance Candidate

Date: 2026-09-29  
Master-prompt origin: post PR #423 Decision Intelligence major reinvention / 100+ upgrades  
Production branch: `release/qelly-global-public-beta`  
CL starting production SHA: `454b481943a7ad5745256859df4bb6000424cfba`

## Executive result

The post-PR423 Decision Intelligence implementation sequence has reached the final acceptance wave.

All planned implementation waves BR through CK are merged into the production branch. PR #448 is the production-line CK browser-evidence hotfix and the production branch is identical to its merge SHA `454b481943a7ad5745256859df4bb6000424cfba`.

Supabase `public.qelly_release_identity` records that exact source revision as a production Cloudflare release for `https://terminal.qellyintelligence.com`, with matching backend revision and status `recorded`.

This CL change is deliberately proof-only. It does not alter provider coverage, market semantics, setup eligibility, probability math, model weights, trade research rules, database schema, or public routes.

Final closure requires the exact CL PR head to pass the full repository gate matrix, be merged with an expected-head guard, deploy, and then be re-verified through the release-identity record. Missing evidence must remain missing; no gate is converted into a pass by documentation.

## START

- Original reinvention baseline: PR #423 / `11ff35cdd934c357c800db4c8e1195a63247d291`.
- Reconciled production base for CL: `454b481943a7ad5745256859df4bb6000424cfba`.
- Production branch comparison at CL start: identical to `454b481943a7ad5745256859df4bb6000424cfba`.
- Production release identity: recorded for the same SHA.
- Canonical recorded public site: `https://terminal.qellyintelligence.com`.

## WAVES

| Wave | PR | Merge SHA | Purpose |
| --- | ---: | --- | --- |
| BR | #424 | `7d4a92f0af9963ef3a9d056aeec6d384842b5819` | Range Selection 2.0 + persistent overlay |
| BS | #425 | `0cadc84e3c7803ba465a81a0eaa1b87ef8cad669` | Bounded range evidence |
| BT | #426 | `daa584aa7791294e037148991dcb1f99ea804149` | Historical news / event timeline |
| BU | #427 | `d311f2caa0da726e79417b1089709e75f96eae49` | Source-bounded flow / participation evidence |
| BV | #428 | `4a9108f81c5440425c37aa022188d1cf0068194d` | Simple / Advanced / Research Lab hierarchy |
| BW | #429 | `c874468501590e6b51a96a89c8b7028797364759` | Contextual bottom-center QELLY Chat dock |
| BX | #430 | `d1a032dac9b1cac6af8361286d1ba76534c01235` | Capability-driven asset picker |
| BY | #431 | `6c0e4875dec34328afb3c9cd40c556b722eaabc9` | Asset-class evidence profiles |
| BZ | #432 | `940a765b5c20407da3fde479cfc85cc021888976` | Find Setup Now + Aggressive Discovery |
| CA | #433 | `7d73e38cfd479333f0dbb34ec170f207badb2ab4` | Next Candle / Next Move research |
| CB | #434 | `3dc66142ce077a4a3a5045e5e49237b00954f13d` | Formula governance + ensemble attribution |
| CC | #435 | `be30bb4989e727639f49bc5481b678ea8382be3d` | Deterministic SMC / price-action library |
| CD | #436 | `852bd3080d6481af5def35b76381dff5bb5023ec` | Fundamentals / macro / asset-class evidence |
| CE | #437 | `a0b9ea3e87bd9eb6b5523f20d9dfbe367164c2bf` | Range replay + similar moves |
| CF | #438 | `97a3d17b646f739f39e1c76019c8ccdd5e4dee6b` | Scenario UX / setup summary / R:R ladder |
| CG | #439 | `7ff6e362b5426df5b82b91ae367f2a1137f03aff` | Selected-range cross-asset analysis |
| CH | #440 | `0246d4212d854d3434ae788fabd67c9768bae32a` | Performance / cache / concurrency |
| CI | #441 | `5412c867c7c75d3714bf40ad378531703b907ccb` | Accessibility / mobile / visual polish |
| CI hardening | #443, #445 | `4b88211a2e1439adf5a2a8fd01f4062be40bc356`, `c7ce64eef1ab9445e1aa5e29526da0b69813e1de` | Redraw-safe mode/picker focus |
| CJ | #446 | `2382e2597e6ca14a6c635c61f75a55158c9fc67c` | Security + failure injection |
| CK | #447 | `29f35794a401dd5f6bc03d215356d17b88f42d99` | Proof-first dead-code cleanup |
| CK hotfix | #448 | `454b481943a7ad5745256859df4bb6000424cfba` | Deterministic first-paint Web Vitals evidence |
| CL | this PR | exact head required | Final exact-head production acceptance |

## RANGE

The merged implementation contains the dedicated range-selection E2E harness plus separate BR/BS/BT/BU/CE/CG tests.

Acceptance surface:
- persistent selected-range overlay and boundaries;
- selected start/end, candle count, duration, move, high/low and timeframe;
- explicit clear behavior;
- selected-range evidence request supersession / cancellation;
- time-bounded news/event evidence;
- source-bounded participation/flow evidence;
- replay / similar-move research;
- selected-range cross-asset evidence;
- mobile and keyboard coverage through the CI wave.

CL does not restate causal certainty. Event/news/flow evidence can be observed, associated, inferred or unavailable; it is not automatically proof of causation.

## UI / UX

The authoritative Decision surface now uses:
- Simple Mode for the primary answer;
- Advanced Mode for deeper evidence;
- Research Lab for full research depth;
- one contextual bottom-center QELLY Chat dock;
- capability-driven grouped asset selection;
- redraw-safe focus preservation and picker focus return;
- mobile-safe/reduced-motion/accessibility behavior from CI.

The master-prompt rule remains intact: advanced data is reorganized, not deleted merely to simplify the page.

## ASSETS

Asset selection is capability-driven rather than a hard-coded six-asset control. The merged implementation includes grouped provider-backed capability metadata and asset-class evidence profiles.

Availability remains evidence/provider dependent. Unsupported or unlicensed classes must remain unavailable rather than being represented as live.

## FIND SETUP

The merged scanner/UI supports:
- Validated Setup;
- Aggressive Discovery;
- Current Asset / All Markets;
- long / short direction filters;
- 1:1, 1:2, 1:3, 1:4, Auto and Custom R:R;
- ranking modes including Highest Quality, Lowest Event Risk and Closest Candidate.

Aggressive Discovery does not override stale-data, provider-failure, critical-event, evidence-quality or probability-truthfulness gates. NO TRADE remains valid.

## MODELS

The Decision engine now has dedicated modules for:
- quant / technical context;
- deterministic SMC and price action;
- formula governance and redundancy control;
- feature/ensemble attribution;
- fundamentals and macro where applicable;
- liquidity/derivatives when real data exists;
- asset-class weighting;
- selected-range cross-asset evidence.

A displayed metric is not automatically a decision weight. Relevant modules may receive zero weight.

## PROBABILITY

Next Candle / Next Move is a research projection and must remain visually and semantically distinct from observed candles.

The strict probability boundary remains:
- calibrated probability is separate from confidence;
- scenario probability is separate from analog frequency;
- sample size and calibration state must be exposed where required;
- 90%+ is not permitted merely because a model score is high;
- high probability requires genuine independent empirical calibration and sufficient sample evidence.

This CL report makes no claim that the system is empirically profitable or that all probability outputs are calibrated.

## PERFORMANCE

Wave CH introduced Decision caching/concurrency controls and corresponding regression coverage. PR #448 makes first-paint Web Vitals collection deterministic without weakening the existing thresholds.

CL acceptance must use the repository's exact-head gates. Historical bounded latency and browser-stability measurements remain evidence with their original denominators; they are not silently promoted into a new production SLO certification.

## SECURITY

Wave CJ explicitly covers:
- SSRF-shaped/unsupported asset rejection before provider fetch;
- malformed/oversized selected-range rejection;
- malicious headline/XSS fixtures;
- rate-limit preservation;
- CSP/embed boundaries;
- TradingView outbound URL allowlisting;
- dependency/provider timeout/degradation paths;
- stale/unavailable labeling without fabricated values.

Wave CK removes only proven-dead Decision presentation CSS and retains compatibility aliases that still have executable ownership.

Current Supabase security-advisor state was rechecked during CL. It reports one external warning: **Leaked Password Protection Disabled**. This is an Auth configuration warning outside the Decision code changes in BR–CK. It remains explicit and unresolved; CL does not relabel it as PASS.

## PRODUCTION

At CL start:
- release branch SHA: `454b481943a7ad5745256859df4bb6000424cfba`;
- Supabase production release identity source revision: same SHA;
- backend revision: same SHA;
- release status: `recorded`;
- recorded public site: `https://terminal.qellyintelligence.com`;
- recorded release timestamp: `2026-09-28T21:00:05.266Z`;
- recorded identity creation: `2026-09-28T21:05:02.171939Z`.

CL finalization is not complete merely because this report exists. The CL PR head must still pass exact-head gates, merge, deploy, and receive its own production release identity.

## LIMITATIONS

The final system must continue to expose, rather than conceal:
- unavailable provider/data families;
- licensing/redistribution limits;
- stale/partial provider states;
- insufficient calibration samples;
- uncalibrated probability states;
- research-only / non-execution boundaries;
- lack of causal proof where evidence is only associated or inferred;
- current external Supabase Auth warning: leaked-password protection disabled.

No documentation change can convert an unavailable feed, insufficient sample, failed gate or uncalibrated model into a pass.

## COMPLETION

At the start of CL:
- planned waves merged before CL: 20 / 21 = **95.2%**;
- implementation waves BR through CK: **complete**;
- CL production acceptance: **this wave**;
- range-intelligence implementation: all planned range waves merged; exact-head CL acceptance pending;
- universal asset coverage: capability-driven implementation complete, actual availability remains provider/licensing dependent;
- scientific probability: calibration governance implemented; empirical calibration remains sample-dependent and is not represented by a fabricated percentage;
- terminal production: exact pre-CL SHA is recorded in production; CL post-merge production identity remains to be proven.

## CL exact-head closure rule

This candidate may be closed only after all of the following are true for the exact CL PR head and subsequent merge:

1. focused and full tests pass;
2. type/syntax/lint/design/environment/secret checks pass;
3. production and frontend builds pass;
4. product validation passes;
5. Security Analysis passes;
6. Public Runtime / Production Parity / Foundation / Container gates pass where configured;
7. Browser E2E and mobile/visual evidence pass;
8. no old UI flash, route crash, iframe lifecycle regression, critical console error or acceptance-threshold regression is introduced;
9. merge uses the exact tested head;
10. the merged release is recorded as the new production source revision in `public.qelly_release_identity`.

Until those conditions are evidenced, state remains `READY_FOR_CL_EXACT_HEAD_GATES`, not final production closure.
