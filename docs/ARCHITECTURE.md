# Qelly Intelligence Architecture

Qelly is a static single-page financial-intelligence client backed by two compatible server surfaces. The canonical public beta runs the compiled `dist/frontend` artifact and `functions/` on Cloudflare Pages. Supabase supplies identity, governed PostgreSQL storage and purpose-built Edge Functions. The portable Node.js 22 ESM runtime in `src/server` and `apps/worker` remains available for deployments that need persistent workers, private object storage or direct infrastructure adapters.

## Request flow

```text
Browser
  -> Cloudflare Pages static shell
  -> same-origin /api/v1/* Pages Function
      -> public read-only providers (bounded, cached, attributed)
      -> Supabase Auth / PostgREST / RPC with the caller session
      -> optional Workers AI binding
  -> Supabase PostgreSQL (RLS plus narrow authenticated read facades)
```

The browser receives only the Supabase project URL and publishable key. Privileged Supabase credentials stay in encrypted server-side bindings. State-changing requests require an approved HTTPS origin, a valid session and CSRF proof. Responses receive CSP, HSTS, frame denial, MIME-sniffing protection and a source-revision header.

## Repository boundaries

- `apps/web/public`: source SPA, route modules, design system and local static assets.
- `functions`: Cloudflare Pages API, middleware, provider adapters and Supabase session boundary.
- `supabase/migrations`: reviewable production schema history, RLS policies, grants, jobs and RPC definitions.
- `supabase/functions`: versioned source for production Edge Functions.
- `src`: portable modular-monolith domains, repositories and Node runtime.
- `apps/worker`: persistent job runner for the portable deployment shape.
- `packages`: schemas, contracts, migrations, design tokens and OpenAPI.
- `scripts`, `tests`, `validation`: build, security, inventory and release evidence.

## Data and provider boundaries

Public sources are fetched only from Pages Functions. Cloudflare point-of-presence caching is source-specific, upstream requests are time-bounded and schema/size checked, and a source failure stays unavailable unless an already-governed stale cache entry is explicitly labelled stale. Binance and Coinbase code paths are policy-gated off pending rights. TradingView is a display/research surface, never a silently reused analytics feed. See `DATA_SOURCES.md`.

Supabase tables use RLS. Two authenticated `SECURITY DEFINER` RPCs expose capped, read-only market snapshots/history over tables that intentionally remain hidden from direct client selection. Both reject missing users, use fully qualified objects, set an empty `search_path`, and revoke execution from `public` and `anon`.

## Portable Node runtime

The modular monolith preserves transaction and authorization consistency while keeping provider, queue and storage adapters replaceable. SQLite, local signatures and quarantined local storage support development; PostgreSQL, Redis signalling, private S3-compatible storage, ClamAV and external delivery are required by strict production mode.

Live trading, custody, transfers, withdrawals, private-key collection and recovery-phrase collection are absent by design.
