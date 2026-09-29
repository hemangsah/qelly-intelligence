# QELLY Post-PR423 Master-Prompt Final Audit

Date: 2026-09-30  
Master-prompt baseline: PR #423 / `11ff35cdd934c357c800db4c8e1195a63247d291`  
Runtime acceptance anchor: `d95a7954d1733cc57ec893b757ee1adb78400539`  
Canonical site: https://terminal.qellyintelligence.com

## Executive result

The planned BR–CL engineering sequence is complete, the audited post-CL software gaps identified during the strict master-prompt review were remediated, and the exact production runtime anchor `d95a7954d1733cc57ec893b757ee1adb78400539` passed the release-branch production gates including Browser E2E.

This report intentionally distinguishes **software / orchestration completion** from **external provider and empirical-data availability**.

- Engineering waves: **21 / 21 — 100% complete**.
- Audited source-supported remediation identified after CL: **complete** through PR #451–#453.
- Production acceptance for the runtime anchor: **PASS**.
- Universal asset capability catalog: **10 / 10 requested categories represented — 100% catalog coverage**.
- Live Decision-selectable category coverage: **1 / 10 categories — 10%** (Crypto).
- Reference-only category coverage: **1 / 10 — 10%** (Forex via ECB context only).
- Explicitly unavailable Decision categories: **8 / 10 — 80%**.
- Live selectable Decision assets: **6** — BTC, ETH, SOL, HYPE, XRP, DOGE.
- Scientific probability governance: **implemented**; empirical calibration is sample-dependent and is not assigned a fabricated completion percentage.
- Trade execution: **not part of this public research product**.

Therefore the accurate final state is:

**ENGINEERING_ACCEPTED_PROVIDER_LIMITED_WITH_EXPLICIT_EXTERNAL_LIMITATIONS**

This is not a claim of universal live-market coverage, profitable trading performance, causal certainty, or calibrated probabilities where the required evidence is absent.

## START / reconciliation

- Original post-PR423 baseline: `11ff35cdd934c357c800db4c8e1195a63247d291`.
- CL implementation acceptance merge: `70438b7c2627be9f2dc3a0e5949e104110cde9f8`.
- Historical CL closure documentation merge: `67db0a915a60f43db299dd5168ee0b97017660db`.
- Audited remediation merge: `e2405ae3d36e167c6533ec3b0bb31cbcbbfe4699`.
- Browser focus-race hardening merge: `d8773911e8b3dc77be7367744fcc7f6747402149`.
- Browser redraw-race hardening / accepted runtime anchor: `d95a7954d1733cc57ec893b757ee1adb78400539`.
- Open PR count at runtime acceptance: **0**.

## WAVES — exact tested heads and merge SHAs

| Wave | PR | Exact tested head | Merge SHA | Purpose |
| --- | ---: | --- | --- | --- |
| BR | #424 | `7cc514fc03acc0847dbf56dc8efbefae8659a6c6` | `7d4a92f0af9963ef3a9d056aeec6d384842b5819` | Range Selection 2.0 + persistent overlay |
| BS | #425 | `8a087c8ea771af04453dad9a6f5900e0457f1c60` | `0cadc84e3c7803ba465a81a0eaa1b87ef8cad669` | Bounded range evidence |
| BT | #426 | `9566c893bd746deeb182db784df609a2dd0d56e4` | `daa584aa7791294e037148991dcb1f99ea804149` | Historical news / event timeline |
| BU | #427 | `ac0aa30c083c46a300a5f677b3f5e25816333879` | `d311f2caa0da726e79417b1089709e75f96eae49` | Flow / participation evidence |
| BV | #428 | `18bb876998ca2684ce58df67b982121b1545fc3d` | `4a9108f81c5440425c37aa022188d1cf0068194d` | Simple / Advanced / Research Lab |
| BW | #429 | `77d71525cab0af64b7e0d109167394e2e22971c0` | `c874468501590e6b51a96a89c8b7028797364759` | Contextual QELLY Chat dock |
| BX | #430 | `d9771237de182c5e52514c791c5c269b5b11b33d` | `d1a032dac9b1cac6af8361286d1ba76534c01235` | Capability-driven asset picker |
| BY | #431 | `fb3a71d9fb0e3b8bd7440e014ef69595dac94754` | `6c0e4875dec34328afb3c9cd40c556b722eaabc9` | Asset-class evidence profiles |
| BZ | #432 | `f762e02790f5d6cbd50961cf54459e8cf3e73566` | `940a765b5c20407da3fde479cfc85cc021888976` | Find Setup Now + Aggressive Discovery |
| CA | #433 | `3a16f8a000d41b934aec97b31d1988bde898b061` | `7d73e38cfd479333f0dbb34ec170f207badb2ab4` | Next Candle / Next Move |
| CB | #434 | `643466d19c8162b3297b5a8afa73f0d01fd6089a` | `3dc66142ce077a4a3a5045e5e49237b00954f13d` | Formula governance + attribution |
| CC | #435 | `1d54c18f18e375b5ed97352e3e6d482fb7ed093a` | `be30bb4989e727639f49bc5481b678ea8382be3d` | SMC / price action |
| CD | #436 | `8e7ce16e5925e458497649c520bd2af5dc1d5dc9` | `852bd3080d6481af5def35b76381dff5bb5023ec` | Fundamentals / macro / asset-class evidence |
| CE | #437 | `c30cf8fd3471dc00b147f79118f91dfa3bc3e88a` | `a0b9ea3e87bd9eb6b5523f20d9dfbe367164c2bf` | Range replay + similar moves |
| CF | #438 | `76a491506e2480efa2eb4ca6cdddb98e06807db2` | `97a3d17b646f739f39e1c76019c8ccdd5e4dee6b` | Scenario UX / setup summary |
| CG | #439 | `865b34755741bfc7f7df58c4b9032776e5df893e` | `7ff6e362b5426df5b82b91ae367f2a1137f03aff` | Selected-range cross-asset analysis |
| CH | #440 | `d9214bbc0a59a5043290765b2eb924976c99d912` | `0246d4212d854d3434ae788fabd67c9768bae32a` | Performance / cache / concurrency |
| CI | #441 | `3bfd1421545c36c0fd0023f25ee16ac73a445827` | `5412c867c7c75d3714bf40ad378531703b907ccb` | Accessibility / mobile / visual polish |
| CJ | #446 | `d630d9299ca8f5d9176262631d269dd4ae60082a` | `2382e2597e6ca14a6c635c61f75a55158c9fc67c` | Security + failure injection |
| CK | #447 | `385db8d6e38ff7eb296e99e4423b371063585745` | `29f35794a401dd5f6bc03d215356d17b88f42d99` | Dead-code cleanup |
| CL | #449 | `8ae10a4e518b4e84c1976dc2614e564abee770dd` | `70438b7c2627be9f2dc3a0e5949e104110cde9f8` | Exact-head final production acceptance |

### Hardening and post-CL remediation

| Change | PR | Exact tested head | Merge SHA |
| --- | ---: | --- | --- |
| CI focus hardening | #443 | `9a9116f3950e7c6bbdfa50b7877ac7fd06c0ee45` | `4b88211a2e1439adf5a2a8fd01f4062be40bc356` |
| Asset-picker focus hardening | #445 | `06e0e95e5afacec2e835b5fc4aefd7ae0238f59f` | `c7ce64eef1ab9445e1aa5e29526da0b69813e1de` |
| CK first-paint hotfix | #448 | `245bfc4dfb8e6f9df341ba8009f00314a1199418` | `454b481943a7ad5745256859df4bb6000424cfba` |
| CL closure documentation | #450 | `2bb323437a80e2af72f739fbc5f7cd853b3b5536` | `67db0a915a60f43db299dd5168ee0b97017660db` |
| Post-CL audited gap closure | #451 | `e6078e7624e2fd2a910ac0df93a65d1e0d1140ca` | `e2405ae3d36e167c6533ec3b0bb31cbcbbfe4699` |
| Glossary-focus E2E hardening | #452 | `d3b5958e42a3c83742b774c3473ab26d922a83cc` | `d8773911e8b3dc77be7367744fcc7f6747402149` |
| Asset-picker redraw E2E hardening | #453 | `01fa801799e734372ab10a5e9946737f38b040ad` | `d95a7954d1733cc57ec893b757ee1adb78400539` |

## RANGE INTELLIGENCE

Implemented and Browser-E2E-covered:

- explicit Navigate / Select Range / Select Candle / Measure Move modes;
- persistent selected-range overlay with start/end boundaries and handles;
- start/end time, duration, candle count, move %, high/low and timeframe;
- exact-range request supersession / cancellation;
- bounded BEFORE / DURING / AFTER news/event timeline;
- flow / participation evidence with source-state boundaries;
- range replay and similar-move research;
- selected-range cross-asset analysis;
- selected-range → current validated setup bridge under similar governed regime conditions;
- desktop/mobile and keyboard/focus coverage;
- Decision glossary/help for R:R, invalidation, funding, OI, calibration, NO TRADE and selected-range evidence.

Historical evidence is truthful but provider-limited:

- indexed macro/rates reporting can be surfaced when bounded historical news contains it;
- indexed protocol/fundamental reporting can be surfaced when present;
- indexed geopolitical/supply-risk reporting can be surfaced when present;
- official historical macro release expected/actual/prior values are not fabricated;
- structured historical fundamentals are not claimed when unavailable;
- historical true L2/order-flow, named-actor flow, options and on-chain history remain unavailable unless a governed source exists.

Range software workflow completion: **100% of planned interaction/orchestration scope**.  
Historical data-family availability is dynamic by source/range and is not assigned a fake fixed percentage.

## UI / UX

Implemented:

- Simple Mode;
- Advanced Mode;
- Research Lab;
- one contextual bottom-center QELLY Chat dock;
- grouped capability-driven asset picker;
- search across normalized identity fields;
- Recent and Favorites;
- explicit market/provider status and supported timeframes;
- 1m / 3m / 5m Scalp grouping;
- 15m / 30m / 1h Intraday grouping;
- 2h / 4h / 1d Swing grouping;
- redraw-safe mode and picker focus;
- responsive / reduced-motion / keyboard behavior;
- five explicit quality dimensions: Data Quality, Evidence Quality, Calibration Quality, MTF Agreement and Contradiction.

## ASSETS / PROVIDERS

Capability catalog categories:

1. Crypto — **SUPPORTED / SELECTABLE**.
2. Forex — **REFERENCE_ONLY** via ECB contextual FX reference rates.
3. Indian indices — **UNAVAILABLE**.
4. Indian stocks — **UNAVAILABLE**.
5. Global stocks — **UNAVAILABLE**.
6. Global indices — **UNAVAILABLE**.
7. Metals — **UNAVAILABLE**.
8. Commodities — **UNAVAILABLE**.
9. Rates / Bonds — **UNAVAILABLE**.
10. ETFs — **UNAVAILABLE**.

Selectable Crypto provider: Hyperliquid public Decision source.

Current normalized selectable instrument fields include:

- canonicalId;
- symbol;
- providerSymbol;
- name;
- assetClass;
- exchange;
- currency;
- category;
- region;
- venue;
- marketStatus;
- providerStatus;
- supportedTimeframes;
- capability list.

Provider-rights boundaries remain fail-closed. Binance/Coinbase display/redistribution uncertainty is not bypassed, and ECB reference data does not imply Decision-grade FX support.

## FIND SETUP NOW

Implemented:

- Validated Setup;
- Aggressive Discovery;
- Current Asset / All Markets;
- Long + Short / Long / Short;
- 1:1, 1:2, 1:3, 1:4, Auto and Custom R:R;
- Highest Quality;
- Lowest Event Risk;
- Fastest Setup;
- Lowest Risk;
- Closest Candidate;
- Highest Calibrated Probability shown as unavailable until genuine target-touch calibration exists;
- Best Available Candidate / Closest Candidate fallback language when no fully validated setup exists;
- top-three setup comparison;
- explicit NO TRADE state.

Aggressive Discovery does not override stale-data, provider-failure, critical-event, evidence-quality, calibration or probability-truthfulness gates.

## MODELS / FORMULAS / SMC

Implemented architecture includes:

- quant / technical context;
- formula governance and redundancy control;
- deterministic SMC / price-action features;
- structure, volatility, liquidity and derivatives evidence where supported;
- fundamentals / macro context where real data exists;
- cross-asset selected-range evidence;
- feature / ensemble attribution;
- asset-class weighting;
- model-health / drift readiness surfaces;
- research-only expected-resolution and lowest-risk ranking heuristics with explicit non-probability boundaries.

A displayed metric is not automatically a model weight. Relevant modules may receive zero weight.

The quantitative implementation is not represented as an indicator-voting machine and the report does not claim every conceivable formula named in the research inventory is independently decisive.

## PROBABILITY / NEXT MOVE

Implemented boundaries:

- projected candles/scenarios remain distinct from observed candles;
- calibrated probability is separate from confidence;
- scenario probability is separate from analog frequency;
- sample size / calibration state / confidence interval remain first-class evidence;
- NO EDGE / UNCERTAIN abstention is explicit;
- “Why not 90%?” explains withholding;
- 90%+ publication requires at least **200 independent resolved outcomes in the relevant reliability bucket** unless a statistically justified pooled model exists;
- no pooled-model exception is currently implemented;
- evidence confidence, indicator agreement, Aggressive Discovery or UI confidence cannot create a 90% probability.

Scientific-probability engineering governance: **100% implemented**.  
Empirical calibration completeness: **sample-dependent / not expressed as a fabricated percentage**.

## PERFORMANCE — exact runtime anchor evidence

Final production Browser E2E on `d95a7954d1733cc57ec893b757ee1adb78400539` passed.

Observed first-paint / stability maxima from the exact production run:

- max FCP: **972 ms**;
- max LCP: **1128 ms**;
- max CLS: **0.00203**;
- max INP: **232 ms**;
- max route transition: **238.9 ms**;
- max long task: **136 ms**;
- long tasks >500 ms: **0**;
- first-party long tasks >500 ms: **0**;
- unexpected network failures in the stability run: **0**;
- route-cycle status: **PASS**;
- Decision-chaos status: **PASS**;
- Decision-chaos requests: 25 Decision + 7 scanner requests;
- Decision-chaos control changes: 20;
- Decision-chaos refreshes: 3;
- listener count start/end: 210 / 210;
- iframe count start/end: 0 / 0;
- pending intervals at end: 0.

Browser acceptance surface:

- exact production artifact validation: PASS;
- cold/warm first-paint stability: PASS;
- 71 registered routes × 2 viewports = **142 renders**;
- accessibility / responsive interaction: PASS;
- screenshot/archive contract: PASS;
- selected-range interaction: PASS;
- timeframe coverage: true;
- Decision education help: true;
- similar-setup bridge: true;
- selected-range failures: none.

## SECURITY

GitHub Security Analysis on the runtime anchor: **PASS**.

Covered failure/security boundaries include:

- SSRF-shaped / unsupported asset rejection before provider fetch;
- malformed and oversized range rejection;
- malicious headline / XSS fixtures;
- rate-limit preservation;
- CSP/embed boundaries;
- TradingView outbound URL allowlisting;
- provider timeout/degradation;
- stale/unavailable labeling without fabricated observations;
- no-crash degradation;
- fail-closed provider and calibration behavior.

Current Supabase security advisor still reports one external warning:

**Leaked Password Protection Disabled**

This remains an explicit production Auth configuration limitation and is not relabeled as PASS.

## PRODUCTION

Accepted runtime anchor:

`d95a7954d1733cc57ec893b757ee1adb78400539`

Release-branch push checks:

- Continuous Integration — PASS;
- Container Build — PASS;
- Production Foundation Services — PASS;
- GitHub Pages Mirror — PASS;
- Public Runtime — PASS;
- Live Terminal Acceptance — PASS;
- Security Analysis — PASS;
- Canonical Hash Route Gate — PASS;
- Browser E2E — PASS.

Cloudflare Pages check: **Deploy successful**.

Canonical production convergence on `https://terminal.qellyintelligence.com`:

- qelly-release.json: exact runtime SHA;
- build identity: exact runtime SHA;
- browser config: exact runtime SHA;
- API config: exact runtime SHA;
- health: HTTP 200 / exact runtime SHA;
- readiness: HTTP 200 / exact runtime SHA / ready;
- two consecutive stable samples: PASS.

Supabase `public.qelly_release_identity` newest production record:

- release key: `cloudflare:d95a7954d1733cc57ec893b757ee1adb78400539`;
- source revision: exact runtime SHA;
- backend version: exact runtime SHA;
- status: `recorded`;
- public site: `https://terminal.qellyintelligence.com`;
- mode: `cloudflare-pages-public-runtime`;
- cloud sync: true;
- authentication: true;
- email delivery: true;
- live providers: true;
- protected writes: true;
- build timestamp: `2026-09-29T16:33:46.518Z`.

## LIMITATIONS

The following remain real limitations, not hidden defects:

- only Crypto is currently Decision-selectable;
- Forex is reference-only;
- Indian/global equities and indices, metals, commodities, rates/bonds and ETFs lack a governed/licensed Decision-grade provider;
- historical true order flow/L2, options and on-chain histories are unavailable where no governed historical source exists;
- official macro-release value history is not fabricated;
- structured fundamentals are not fabricated;
- empirical probability calibration remains bucket/sample dependent;
- research output is not trade execution;
- association is not causal proof;
- no profitability guarantee exists;
- Supabase leaked-password protection remains disabled.

## COMPLETION

- Planned BR–CL engineering waves: **21 / 21 = 100%**.
- Audited source-supported post-CL remediation: **100% closed** for the concrete gaps identified and implementable without inventing providers.
- Range interaction/orchestration software: **100%**.
- Asset capability catalog representation: **10 / 10 categories = 100%**.
- Live Decision-selectable asset-category coverage: **1 / 10 = 10%**.
- Reference-only category coverage: **1 / 10 = 10%**.
- Explicitly unavailable categories: **8 / 10 = 80%**.
- Scientific-probability governance implementation: **100%**.
- Empirical calibration completion: **not assigned a fabricated percentage**.
- Production runtime acceptance: **100% of required release-branch gates passed**.
- Open PRs at runtime acceptance: **0**.

## Final acceptance

The Decision Intelligence engineering/release program is accepted at runtime anchor `d95a7954d1733cc57ec893b757ee1adb78400539`.

The correct final description is:

**Production engineering complete and accepted; master-prompt software remediation complete; live data/asset universality remains provider-limited by design and must not be represented as 100% market coverage.**

This audit document is documentation-only. A later documentation commit may advance the repository SHA without changing Decision runtime semantics; the runtime acceptance anchor above remains the functional evidence reference.
