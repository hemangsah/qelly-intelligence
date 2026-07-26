# Part 16 Implementation Decisions

## 1. Preserve completed waves

Part 16 treats the checksum-verified Part 12.7 baseline and the Part 14–15 implementations as immutable release ancestry. New work is additive and isolated in Wave 4 service, contract, schema, route and evidence modules.

## 2. Normalize before distribution

The time-series layer stores canonical instrument IDs, UTC timestamps and decimal strings. Provider-specific shapes are not exposed to frontend consumers. Each response carries source, freshness, quality, entitlement and methodology metadata.

## 3. Deterministic local persistence

The release uses atomic temp-write/rename JSON persistence to make development behavior repeatable without adding dependencies. Eight instruments receive 360 hourly points each, anchored at a fixed fixture timestamp. Aggregated intervals are derived from normalized 1h source points.

## 4. Govern writes even in a fixture runtime

Appending history is denied without `timeseries:write`, tenant/workspace context and simulated high assurance. Requests are idempotent, sequence-checked and audited. This preserves the intended production control shape without claiming production authentication.

## 5. Snapshot before delta

Every quote SSE connection starts with a complete snapshot and then emits deltas. Events receive a channel-local sequence, event ID and resume token. A bounded persistent journal supports replay and makes sequence gaps explicit rather than silently masking them.

## 6. Truthful recovery semantics

When a requested sequence predates retained history, replay returns `gap: true`, the missing range and `request-fresh-snapshot` guidance. The local system does not claim exactly-once delivery or distributed durability.

## 7. Privacy-safe local observability

Request instrumentation stores bounded operational metadata and does not capture request bodies, secrets or user financial data. Metrics, traces and logs remain in process and are never exported. SLO calculations are labeled `candidate-only`.

## 8. Frontend evidence equals backend capability

Time Series Lab, Stream Operations and Observability Center call the actual packaged APIs. The frontend displays operational truth boundaries, source/quality metadata and disabled-production states rather than presenting simulated behavior as a live market service.

## 9. Production gates remain explicit

Before a production Wave 4 deployment, separate gates are required for database selection and migrations, broker topology, partitioning, retention policy, licensed-feed sequencing, telemetry privacy review, OpenTelemetry/export infrastructure, SLO ownership, alert routing, disaster recovery, capacity tests and security signoff.
