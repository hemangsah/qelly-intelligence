# Wave 3 Runtime and Reference-Data Foundation

## Provider runtime

Three deterministic adapters implement read-only search, quote and timeseries behavior. Runtime controls include deadlines, bounded retry, circuit breaker, bulkhead, deduplication, local quota, TTL cache, stale last-known-good fallback, latency/quality/cost metrics and automatic failover.

## Entitlements

The local policy engine allows only internal development-fixture reads with attribution, freshness and audit obligations. Licensed classes, external export and redistribution are denied.

## Data quality

Quote schema/range/timestamp/outlier checks, reconciliation, confidence scores, duplicate/sequence checks, incidents and audited overrides are implemented locally.

## Instrument master

A persistent atomic-JSON master supplies immutable QI IDs, symbols with validity periods, identifiers, venues, calendars, currencies, taxonomy, relationships, deterministic resolution and revisioned governance mutations.

External credentials, licensed feeds, distributed caches/quotas, transactional databases, production reference-data completeness and maker-checker workflows remain deferred.
