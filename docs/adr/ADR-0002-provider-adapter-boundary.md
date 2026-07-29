# ADR-0002: Provider adapter and authorization boundary

Status: accepted for draft public-beta foundation
Date: 2026-07-29

## Decision

Every external provider is isolated behind a typed adapter with timeout, abort handling, health state, last-success and last-failure evidence, entitlement and redistribution metadata, and a provider-level kill switch.

Public-beta integrations are read-only first. Authorization is performed only through official OAuth or provider-supported flows. Browser storage must not receive private keys, seed phrases or unrestricted long-lived provider credentials.

## Required adapter behavior

- schema validation;
- bounded timeout and cancellation;
- retry and circuit-breaker policy in provider-specific implementations;
- quota and rate-limit awareness;
- caching and stale state that remain visibly classified;
- health and observability events;
- deterministic unavailable state when a provider fails;
- terms, attribution and redistribution metadata;
- explicit user disconnect and provider kill switch.

## Consequences

No one connector can represent brokers, banks, exchanges and wallets. Each provider family receives a separately governed adapter and jurisdiction review. Trading scopes remain disabled until a separately authorized execution program.
