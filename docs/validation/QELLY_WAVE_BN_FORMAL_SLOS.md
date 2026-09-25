# QELLY Wave BN — Formal measured SLOs

Status: focused SLO policy/evaluation wave  
Base production: `abbb2a9e92eec2976643d7346f6c8a79b786523f`

## Objective

Turn Wave BM privacy-safe observability into explicit operational objectives without claiming service health from tiny samples.

BN does **not** define trading-performance objectives. No SLO concerns profitability, win rate, target-touch probability, expected value or forecast calibration.

## Pre-BN latency evidence

Two bounded external audit samples were collected before this policy was fixed:

- earlier canonical sample: Decision p50 about 1.51 s / p95 about 1.77 s; scanner p50 about 2.72 s / p95 about 3.06 s;
- later exact-preview sample: Decision p50 about 2.12 s / p95 about 2.39 s; scanner p50 about 3.25 s / p95 about 3.62 s.

These were small samples and are not certification data. They were used only to choose targets with headroom:

- Decision p95 <= 3000 ms;
- scanner p95 <= 4500 ms.

Certification requires at least 20 bounded in-product observations for each latency objective.

## Formal objectives

- Decision p95 <= 3000 ms, n >= 20;
- scanner p95 <= 4500 ms, n >= 20;
- per-provider failure rate <= 10%, n >= 10 explicit provider observations;
- stale-evidence rate <= 10%, n >= 50 evidence observations;
- route error rate <= 2%, n >= 20 Decision/scanner observations;
- widget/embed error rate <= 2%, n >= 20 Decision/scanner observations;
- memory anomalies = 0, n >= 10 captured route samples;
- LCP <= 2500 ms when observed;
- INP <= 200 ms when observed;
- CLS <= 0.10 when observed;
- repeated >500 ms long tasks = 0, n >= 10 captured route samples.

## State model

Every objective is one of:

- `PASS` — minimum sample reached and target satisfied;
- `VIOLATION` — minimum sample reached and target breached;
- `INSUFFICIENT_SAMPLE` — metric exists but its minimum sample is not reached;
- `UNAVAILABLE` — the metric has not been observed.

Overall state:

- `VIOLATION` if any measured objective violates;
- `OBSERVING` if there is no violation but any objective is unavailable/under-sampled;
- `PASS` only when every applicable objective is measured and passing.

Therefore `INSUFFICIENT_SAMPLE` and `UNAVAILABLE` never count as green.

## Provider denominator repair

BM now records explicit provider observation counts and provider failure counts beside its legacy failure map. BN computes provider failure rate only from those explicit denominators.

Absent providers are `UNAVAILABLE`, not assumed healthy.

## Privacy and scientific boundaries

BN consumes only the BM privacy-safe snapshot.

It does not store or require:

- asset identifiers;
- prices;
- entries/stops/targets;
- custom R:R values;
- prompts or conversations;
- user/account identifiers.

SLO status never feeds QELLY VIEW, scanner eligibility, calibration, target-touch, R:R feasibility or trade lifecycle.

## Acceptance

BN is complete only when:

1. focused BN tests pass;
2. full repository/security/build/runtime/browser gates pass on the exact PR head;
3. exact preview exposes the SLO evaluator through the Decision workspace;
4. low-sample metrics stay OBSERVING instead of PASS;
5. production/canonical/Supabase release identity is verified after merge.
