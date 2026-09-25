# QELLY Wave BM — Privacy-safe observability

Status: focused observability wave  
Base production: `f9a15ea27fbeeec38eb2f045d97a3b3353dd03e6`

## Objective

Track the master-prompt metric families without logging secrets, identifiers, prices, targets, custom R:R values, raw prompts, files, or private conversation text.

BM is **measurement plumbing**, not an SLO certification. Wave BN owns measured SLO targets and before/after evaluation.

## Architecture

### Bounded browser-memory diagnostics

`apps/web/public/assets/decision-observability.mjs` keeps at most:

- 64 Decision end-to-end client observations;
- 64 scanner end-to-end client observations;
- 64 observations per mapped provider/component timing.

From those bounded samples it exposes:

- p50 / p90 / p95 / max Decision latency;
- p50 / p90 / p95 / max scanner latency;
- p50 / p90 / p95 provider/component latency.

The current snapshot is available for browser validation at:

`window.__QELLY_DECISION_OBSERVABILITY__.snapshot()`

It is intentionally ephemeral and not a user-history store.

### Existing coarse analytics channel

The existing `qelly:runtime-signal` → allowlisted public analytics path remains the only persistence/transport surface for BM.

BM emits only coarse buckets such as:

- Decision latency bucket;
- scanner latency bucket;
- NO TRADE yes/no state;
- target-touch sample-size bucket.

The public analytics endpoint continues to log aggregate counts only.

## Metric coverage

BM records:

- Decision p50 / p90 / p95;
- scanner p50 / p90 / p95;
- provider/component p50 / p90 / p95;
- provider failures;
- stale evidence observations;
- Decision failures;
- scanner failures;
- directional-eligibility count;
- scanner eligible-setup count;
- NO TRADE count/frequency;
- selected R:R category;
- scenario-calibration state;
- target-touch sample from the authenticated real setup ledger when available;
- route/browser error counts;
- widget/embed failure counts from coarse runtime signals;
- memory-pressure signals;
- Web Vitals from the existing runtime performance observer;
- long-task counts and budget exceedances;
- external resource aggregates already maintained by the runtime observer.

## Target-touch boundary

Target-touch sample size is **not** substituted from:

- scenario walk-forward calibration;
- historical analog count;
- candle sample size.

When an authenticated workspace ledger is available, BM uses:

- `calibrationEligible`;
- `minimumSampleGate`;
- `calibrationState`;
- `observedSetups`.

When it is unavailable, BM reports target-touch sample state as `UNAVAILABLE` with sample size 0.

## Provider timing boundary

Provider/component durations are obtained from the existing Decision performance receipt.

They can overlap because independent provider requests run concurrently.

Therefore BM explicitly forbids summing component durations to infer total Decision latency.

## Privacy boundary

BM records no:

- asset identifier;
- market price;
- entry / stop / target;
- prompt;
- conversation text;
- custom R:R numeric value;
- email or account identifier;
- authorization or cookie value;
- secrets.

Only the coarse R:R category (`auto`, `custom`, `1:1` … `1:4`) is retained.

## Scientific boundary

Observability never feeds:

- `directionalEligible`;
- scanner research priority;
- QELLY VIEW;
- calibration;
- target-touch probability;
- R:R feasibility;
- trade lifecycle.

It only measures already-computed system behavior.

## Acceptance

Wave BM is complete only when:

1. focused BM tests pass;
2. full repository/security/build/runtime/browser gates remain green;
3. exact preview runtime exposes bounded Decision/scanner/provider percentiles;
4. the snapshot contains no raw market/private inputs;
5. target-touch sample remains sourced from the real ledger only;
6. production release identity is verified after merge.
