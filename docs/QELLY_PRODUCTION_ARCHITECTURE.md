# Qelly Global Public Beta Architecture

Status: `IMPLEMENTATION_IN_PROGRESS`

## Immutable foundation

Prompt 2C is stacked on `feature/calculator-and-indicator-foundation` at Prompt 2B closure head `17eeadac4c510cc3c312185e86b0ac5907f3789b`. It does not rewrite the accepted 151 formulas, 54 indicators, 70 routes, 429 governed screens, 1,944 browser records, 54 accessibility checks or 19 saved-lifecycle actions.

## Runtime boundaries

1. **Deterministic browser layer** — calculators, formulas, indicators and local saved calculations remain available without an account and during provider or cloud failure.
2. **Public static edge** — GitHub Pages is the immediate no-cost fallback. Cloudflare Pages is preferred only after normal account authorization.
3. **Edge API** — typed public status, provider and protected-write endpoints. It owns security headers, CORS, CSRF, Turnstile validation, idempotency, rate limits, correlation IDs and response-size limits.
4. **Identity adapter** — Supabase Auth is preferred after normal authorization. No custom password store is introduced. Anonymous deterministic use remains supported.
5. **Postgres adapter** — Supabase-compatible Postgres migrations own profiles, workspaces, membership, saved calculations, revisions, sync operations, feedback, deletion requests and audit records.
6. **Authorization boundary** — every user-owned table has row-level security. Service-role access is server-only. The browser receives only an anonymous public key.
7. **Local-first sync** — cloud synchronization is explicit opt-in. Pending local operations survive offline use. Conflicts are never silently overwritten and require a deterministic or user-selected resolution.
8. **Provider gateway** — providers must be official public read-only or normally authorized. Every response carries provider, source identifier, observation time, ingestion time, freshness, quality, confidence, fallback reason, attribution and license state.
9. **Quota governor** — free-tier usage is measured before exhaustion. At thresholds Qelly warns, serves cache, preserves deterministic local mode and suspends nonessential writes. It never upgrades, attaches payment or enables billable overages.
10. **Observability** — structured events use correlation IDs and redaction. Calculation inputs, result payloads, emails, session tokens and provider secrets are excluded from analytics and logs.

## Truth states

Every connected datum must use one of: `live_provider`, `delayed_provider`, `cached_provider`, `stale_provider`, `simulated_demonstration` or `unavailable`. A configured adapter is not proof of a live provider. GitHub Pages deployments are labelled deterministic/static public beta; cloud account and synchronization controls remain unavailable until verified authorization and isolation tests pass.

## Failure modes

- **Cloud unavailable:** stay local-only; do not upload without opt-in.
- **Auth unavailable:** calculators and libraries continue; cloud actions show authentication unavailable.
- **Provider failure:** use bounded stale cache or deterministic demonstration data with an explicit fallback reason.
- **Quota pressure:** disable nonessential writes before hard limits and show a capacity notice.
- **Turnstile unavailable:** protected writes fail closed; read-only calculators remain accessible.
- **Migration failure:** stop release, preserve the prior deployment, execute the rollback rehearsal and never partially claim cloud readiness.
- **Deployment failure:** retain the last accepted GitHub Pages release and record the failed exact head.

## Vendor replacement paths

Cloudflare Pages/Workers can be replaced by any standards-compatible static host and edge runtime. Supabase can be replaced by another Postgres/Auth provider through repository-owned adapters. Provider integrations are registry-based and must not leak vendor-specific response shapes into calculation engines.

## Prohibited capabilities

Trading, custody, deposits, withdrawals, transfers, private-key or seed handling, brokerage or exchange execution, wallet signing, autonomous investment decisions and personalized financial advice remain disabled by architecture and product policy.
