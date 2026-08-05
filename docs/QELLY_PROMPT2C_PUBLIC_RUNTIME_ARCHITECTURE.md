# Qelly Prompt 2C Public Runtime Architecture

## Decision

The accepted public-runtime delta uses **Option B: a Cloudflare Pages Functions API facade preserving the existing `/api/v1` browser contracts**.

Supabase Auth remains the only identity provider. Qelly does not store passwords, create a parallel identity database, or expose service-role credentials to the browser.

## Why Option B

The existing 70-route frontend already calls `/api/v1/auth/*`, `/api/v1/config`, `/api/v1/session/context`, saved-calculation, synchronization and provider routes. Preserving those contracts minimizes shared frontend change and protects the accepted Prompt 2B visual and deterministic evidence.

Option A was rejected because direct browser SDK migration would require broad changes to the existing API client and route components. Option C was rejected because mixing direct browser sessions with the existing cookie-oriented API would create two session models. The selected facade keeps one Supabase identity and one server session boundary.

## Session and Auth model

1. Registration, login, recovery and refresh are delegated to Supabase Auth REST endpoints using the browser-safe publishable key.
2. Supabase access and refresh tokens are stored only in `Secure`, `HttpOnly`, `SameSite=Lax` cookies.
3. Email-verification and recovery fragments are transferred once by `/auth/callback.html` to `/api/v1/auth/session`; the URL fragment is then removed.
4. State-changing API requests require a strict-origin check plus a CSRF double-submit token.
5. JWT issuer, audience, expiration and subject are checked locally, then the access token is verified by Supabase `/auth/v1/user` before identity is trusted.
6. Expired access tokens are refreshed through Supabase and rotated back into HttpOnly cookies.

## RLS data model

Pages Functions forward the verified user access token to Supabase PostgREST. Existing RLS policies remain authoritative. Functions derive `owner_id` and `workspace_id` from the verified session and never trust a client-supplied tenant identifier.

The runtime covers profile/default-workspace bootstrap, explicit cloud opt-in, saved-calculation create/read/update/soft-delete/restore, revision reads/restores, idempotent sync push, sync pull, conflict detection, account export, deletion request and authenticated feedback.

The optional `QELLY_SUPABASE_SERVICE_ROLE_KEY` is not required for normal operation. It may be stored only in Cloudflare secret storage when immediate deletion of the Supabase Auth identity is explicitly enabled. It is never emitted in public configuration or compiled assets.

## Provider model

Cloudflare Functions proxy official public endpoints for:

- Binance Spot public market data;
- Coinbase Exchange public market data;
- European Central Bank euro reference rates.

Responses include provider identity, source identifier, observation and ingestion timestamps, freshness, quality, confidence, attribution, licensing context and cache state. Cache API entries support fresh and stale states. Upstream failure returns a truthful unavailable state and never disables deterministic local tools.

## Security and privacy controls

- strict same-origin CORS allowlist;
- CSP, HSTS, Referrer-Policy, Permissions-Policy, MIME and frame protections;
- request-size and schema validation;
- CSRF proof on cookie-authenticated mutations;
- idempotency keys for sync writes;
- optional Cloudflare rate-limit binding with a bounded per-isolate fallback;
- correlation IDs and metadata-only logging;
- no request bodies, financial inputs, passwords, tokens or calculation payloads in logs;
- service-role and private-key markers rejected from compiled assets;
- no trading, custody, transfers, wallet signing or autonomous execution.

## Release boundary

`603cece3091dc59cfb72680914e7056b40058022` remains the immutable deterministic local-only fallback. The connected runtime is accepted only at a separately validated exact head. The release branch may advance only after the complete repository and Prompt 2C release gates pass.
