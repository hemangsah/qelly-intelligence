# QELLY Post-PR384 Decision Architecture and Latency Audit

Date: 2026-09-24
Baseline production SHA: `0fc22351c5fcf4541892954e273ef58e95691106`
Scope: Next-Frontier Wave Q only. This document maps the authoritative Decision Intelligence runtime and records the pre-change latency baseline. It does not recreate the completed post-PR361 master-acceptance work.

## Production reconciliation

- Release branch: `release/qelly-global-public-beta`.
- Production release identity: `0fc22351c5fcf4541892954e273ef58e95691106`.
- No repository commits newer than PR #384 were present when this wave started.
- No open pull requests were present when this wave started.
- Canonical production URL: `https://terminal.qellyintelligence.com/`.
- `/qelly-release.json` reported the same release SHA and `cloudflare-pages-public-runtime` mode.
- Production Supabase project: `ssdgfgqnjlwzkgukzeef`, healthy at audit time.
- `public.qelly_release_identity` independently recorded production `source_revision` `0fc22351c5fcf4541892954e273ef58e95691106`, release key `cloudflare:0fc22351c5fcf4541892954e273ef58e95691106`, canonical site `https://terminal.qellyintelligence.com`, and `cloudflare-pages-public-runtime` mode.

## Authoritative ownership map

| Capability | Authoritative owner | Notes |
| --- | --- | --- |
| Decision route, header, chart, controls | `apps/web/public/assets/routes/decision-proven-graph.mjs` | One public workspace owner. |
| Decision public API orchestration | `functions/api/v1/decision-proven-graph.js` | Provider fetch, evidence assembly, calibration gate, trade research and context bundle. |
| Find Trade Now scanner API | `functions/api/v1/decision-scan.js` | Six governed assets, pool limit 2, no-news scan path. |
| Base Decision model + scenarios + walk-forward calibration | `functions/_lib/decision-proven-graph.js` | Candle normalization, evidence graph, scenarios and calibration primitives. |
| Quant/risk/market structure | `functions/_lib/decision-quant-risk.js` | Deterministic derived market-state features. |
| R:R, entry, stop, invalidation, targets, expiry, instantaneous lifecycle | `functions/_lib/decision-trade-research.js` | Research-only; target-touch probability and EV are currently unavailable. |
| Historical analogs | `functions/_lib/decision-historical-analogs.js` | Leakage-guarded; forward outcomes attach only after matching. |
| Current L2 liquidity | `functions/_lib/decision-liquidity.js` + Decision API | Hyperliquid point-in-time context. |
| Current derivatives + funding history | `functions/_lib/decision-derivatives.js` + Decision API | Current context and settled funding history; historical OI change remains unavailable. |
| Cross-asset evidence | `functions/_lib/decision-cross-asset.js` | Same-venue aligned log-return correlation/beta; descriptive only. |
| Past / Present / Future, contradiction, What Changed, Decision Trace | `functions/_lib/decision-context.js` | Explanatory context; no second hidden decision engine. |
| QELLY Chat Decision receipt | `functions/_lib/qelly-chat-tools.js` | Compacts authoritative Decision output for grounded chat use. |
| Cross-route asset/timeframe handoff | `apps/web/public/assets/decision-context-bridge.mjs` | Session-scoped asset/timeframe context. |
| Runtime rate limits / response helpers | `functions/_lib/runtime.js` | Public Decision and scan endpoint controls. |

## Current request graph

### Single Decision

1. Start optional GDELT news request.
2. Fetch selected-asset Hyperliquid candle history.
3. After the selected history resolves, fan out in parallel:
   - three independent supporting timeframes;
   - current perpetual context;
   - current L2 book;
   - settled funding history;
   - benchmark candles for cross-asset evidence.
4. Compute selected-timeframe Decision graph.
5. Compute walk-forward calibration and bounded historical analogs from the already-fetched selected history.
6. Apply evidence/calibration/liquidity gates.
7. Attach current derivatives, liquidity, cross-asset, explicit macro/event-risk availability boundaries and optional news.
8. Build governed trade research.
9. Build Past / Present / Future, contradiction analysis, What Changed snapshot and Decision Trace.
10. Return a cacheable public read-only response.

### Find Trade Now

- Universe: BTC, ETH, SOL, HYPE, XRP, DOGE.
- Scanner calls the authoritative Decision builder with `includeNews:false`.
- Asset concurrency is bounded to 2.
- Each candidate preserves the full evidence/calibration gates.
- Scanner ranking is explicitly an evidence-triage score, not success probability.
- No eligible setup is a valid first-class result.

## Pre-change production latency baseline

Observed from the canonical production domain immediately before Wave Q:

| Surface | Observed latency |
| --- | ---: |
| Terminal document | ~486 ms |
| Release identity | ~461 ms |
| BTC 15m / 4h / Auto Decision API | ~3,056 ms |
| Six-asset BTC/ETH/SOL/HYPE/XRP/DOGE 15m / 4h / Auto scanner | ~2,556 ms |

These values are point observations, not percentile claims. Subsequent optimization waves must compare like-for-like calls and must not reduce evidence coverage merely to improve timing.

## Latency ownership and risk map

### Provider/network

- Selected candle history is deliberately resolved before the optional Hyperliquid fan-out. This protects the mandatory input from provider burst contention but adds one serial provider round trip.
- Supporting timeframes are parallel after that gate.
- Current derivatives, L2 liquidity, settled funding history and benchmark candles are also parallel after that gate.
- GDELT news begins before the selected candle request and therefore does not extend the Hyperliquid burst.
- News is bounded to 2.5 seconds per attempt and is optional; scanner disables it.
- Decision responses use short public cache directives, but provider-response coalescing/shared candle caching is not owned inside the Decision API today.

### CPU

- Main graph runs 256 scenario paths.
- Each supporting timeframe runs a smaller graph with 48 scenario paths.
- Walk-forward calibration and analog matching reuse the selected raw history but perform independent derived computation.
- Historical analog candidate work is bounded.
- No evidence should be removed solely to reduce CPU time.

### Scanner amplification

A six-asset scan executes six complete Decision builds. Even with pool concurrency 2, repeated same-interval provider requests and repeated derived computation dominate total work. Wave R and the later latency wave should optimize shared provider responses or a dedicated governed scan snapshot only when equivalence is provable.

## Confirmed next-frontier gaps

1. Auto R:R currently chooses the largest target among `HIGH` or `MEDIUM` feasibility candidates rather than scoring the best structurally valid ratio.
2. Feasibility vocabulary is the older `HIGH / MEDIUM / LOW / NOT FEASIBLE / UNAVAILABLE` set rather than the Next-Frontier semantic states.
3. Liquidity is risk context but is not represented as its own trade-research invalidation layer.
4. The current lifecycle object is intentionally instantaneous and non-backfilled. A real observed setup/outcome ledger does not yet exist.
5. Target-touch calibration is correctly unavailable because no real persisted setup-outcome sample is yet established.
6. Event risk and intraday macro are explicitly unavailable; they must remain unavailable until a verified production feed exists.
7. The Decision header is authoritative but does not yet expose the complete Next-Frontier action set.
8. QELLY Chat receives a rich Decision tool receipt server-side, while the route-level handoff still preserves only bounded asset/timeframe state; structured current-decision handoff can be strengthened without duplicating the decision engine.

## Safety/truth invariants for all subsequent waves

- WAIT and NO TRADE remain first-class outcomes.
- Scenario probabilities are not trade-win probabilities.
- Historical analog positive share is not win probability.
- Target-touch probability and EV stay unavailable until independently calibrated on real observed setup outcomes.
- Missing macro, event, options, on-chain and liquidation feeds remain explicitly unavailable.
- Cross-asset correlation remains descriptive and non-causal.
- No trade execution, broker integration or personalized recommendation is introduced.
- No provider request or derived calculation may be silently dropped merely to improve latency.

## Wave Q conclusion

The post-PR384 architecture is already converged around one authoritative Decision runtime. The highest-value next changes are therefore incremental: make R:R selection structurally ranked, deepen invalidation semantics, establish a real observed lifecycle ledger before any target-touch calibration, and later reduce duplicated provider/compute work with measured equivalence tests.
