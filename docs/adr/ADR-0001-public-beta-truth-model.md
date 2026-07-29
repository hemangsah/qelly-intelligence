# ADR-0001: Public-beta truth and evidence model

Status: accepted for draft public-beta foundation
Date: 2026-07-29

## Decision

Every public-beta capability and value must expose a machine-readable and visible truth state from the canonical 13-state vocabulary. Connected, deterministic, simulated, estimated, embedded and unavailable capabilities must never be conflated.

Where applicable, values carry source, provider, observation and retrieval time, freshness, timezone, units, instrument identity, methodology version, confidence, entitlement, redistribution boundary, fallback, quality warning and lineage identifier.

## Consequences

- Fixture or simulated data cannot silently replace failed provider data.
- UI components must render source and freshness without inventing live status.
- Provider adapters return governed evidence envelopes.
- Existing static-preview areas remain labelled as such.
- Live trading and custody remain outside this program.
