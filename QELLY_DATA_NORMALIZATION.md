# Qelly market-data normalization standard

## Canonical identity

Qelly canonical identifiers are stable identity keys. Symbols are aliases with history, not identity. Normalization must retain the raw provider identifier and every mapping decision.

Core normalized entities include assets, pairs, exchanges, derivative contracts, options contracts, observations, candles, order books, trades, funding, open interest, liquidations, flows, news, events, and research sources.

## Required observation envelope

Every normalized record should carry:

- canonical and raw provider identifiers;
- provider, source, venue, and entitlement class;
- observed, received, and ingested times with timezone;
- currency, unit, precision, and contract type;
- freshness class and threshold;
- quality state, confidence, and quality flags;
- cache state and fallback reason;
- methodology identifier and version;
- correlation and audit identifiers where appropriate.

## Reconciliation rules

- Never merge provider values without retaining lineage.
- Preserve provider disagreement as data; do not silently choose consensus.
- Treat missing as unavailable, never zero.
- Quarantine outliers pending explicit quality policy.
- Apply currency, unit, inverse-contract, and stablecoin-quote transformations as versioned methods.
- Maintain symbol history, migrations, redenominations, wrapped-asset relations, derivative expiry, and venue-specific contract details.
- Treat observation time, ingestion time, and display freshness as different concepts.

## Persistence boundary

The repository already provides canonical instruments, provider fixtures/adapters, timeseries, evidence, and PostgreSQL migrations. Broader market normalization requires new schemas, constraints, migrations, retention policy, provider licensing, reconciliation tests, and backfill operations. Deterministic demo observations remain a separate non-production classification.
