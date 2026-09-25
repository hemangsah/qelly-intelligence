# QELLY Wave BK — Security Hardening

Status: repository security hardening record  
Scope: production Supabase + Cloudflare public runtime

## Governed read RPC boundary

The public Data API previously exposed two authenticated `SECURITY DEFINER` functions:

- `public.qelly_market_data_snapshot(integer)`
- `public.qelly_timeseries_history(text, integer)`

Both were read-only, required `auth.uid()`, pinned an empty `search_path`, and returned bounded governed projections. However, because they were owned by `postgres`, direct execution from the exposed `public` schema bypassed the browser-deny RLS policies on the underlying governed tables.

Wave BK moves the privileged implementations into `qelly_private` and replaces the exposed functions with `SECURITY INVOKER` wrappers. The public signatures remain unchanged for the authenticated Cloudflare facades. Anonymous, PUBLIC and service-role execution on the public wrappers is explicitly revoked; authenticated execution is granted narrowly. Raw governed tables keep their existing RLS policies and browser-deny grants.

This follows the same private-definer/public-invoker architecture already used by QELLY's authenticated self-delete boundary.

## Existing controls re-audited

The repository already enforces:

- PKCE auth callback flow and token-free browser callback payloads;
- HttpOnly session cookies, CSRF binding, stale-session cleanup and refresh fail-closed behavior;
- explicit CSP allowlists with no wildcard script/frame expansion;
- no `unsafe-eval` in production script policy;
- provider-cache and governed raw-table browser denial;
- server-side rate limiting on authenticated data-plane/time-series routes;
- scheduler credentials through Supabase Vault rather than plaintext migrations;
- formula/prototype-pollution and spreadsheet-export injection guards;
- redirect allowlisting and no fragment-token auth flow.

## Manual / external control

**Leaked-password protection:** the current Supabase security advisor reports that Supabase Auth leaked-password protection is disabled. The connected database tooling exposes the advisor state but does not provide a safe project-auth setting action for enabling this control. It therefore remains a **manual/external** Supabase Auth configuration item and is not represented as fixed by repository code.

Required operator action: enable leaked-password protection in the Supabase Auth password-security settings when available for the current project plan, then rerun the Supabase security advisors and record the result.

## Non-actions

- No raw governed table was granted broader browser SELECT access.
- No service-role key was added to frontend code or public runtime configuration.
- No unused index was dropped solely because a low-volume environment has not exercised it.
- No security advisor was suppressed to obtain a green report.
