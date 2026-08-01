# Qelly Prompt 2C Provider Policy

A provider may be enabled only when its official terms permit the intended read-only use or when the user has completed the provider's normal authorization flow.

## Required registry fields

Provider ID, legal entity, official endpoint, capability list, terms state, authentication state, attribution, license note, cache TTL, stale window, quota, rate-limit response, geographic limitation, personal-data classification and disable switch.

## Truth contract

Every returned datum exposes provider, source identifier, observation time, ingestion time, truth state, freshness, quality, confidence, fallback reason, attribution and license. `live_provider` and `delayed_provider` require a successful request proven at runtime. A fixture, mock, contract or configured URL is never sufficient.

## Allowed states

- `approved_public_read_only`
- `authorization_required`
- `prohibited`

## Runtime states

- `live_provider`
- `delayed_provider`
- `cached_provider`
- `stale_provider`
- `simulated_demonstration`
- `unavailable`

## Cache rules

Cache keys include provider, capability, canonical source identifier and normalized parameters. TTL is set by data class. Stale-while-revalidate is bounded. Expired data is unavailable, not silently reused. Negative caching protects quotas from repeated invalid requests. Provider provenance survives every cache transition.

## Failure behavior

On rate limit, timeout, upstream failure or quota pressure, Qelly uses cache only within the declared stale window. Otherwise it returns unavailable or deterministic demonstration data with an explicit fallback reason. It does not scrape an alternate source that lacks permission.

## Prohibited use

No order placement, brokerage or exchange execution, custody, deposits, withdrawals, transfers, wallet signing, seed/private-key handling, autonomous investment decisions or personalized financial advice.
