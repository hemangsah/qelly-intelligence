# Cloudflare Pages Free — Qelly Public Runtime Configuration

## Project

- Repository: `hemangsah/qelly-intelligence`
- Production branch: `release/qelly-global-public-beta`
- Build command: `npm ci --ignore-scripts && npm run build:frontend`
- Build output directory: `dist/frontend`
- Functions directory: repository-root `functions`
- Plan: Pages/Workers Free only
- Do not attach payment, enable paid overages or purchase a domain.

## Required public variables

Set these in the official Cloudflare Pages project environment:

```text
QELLY_REQUIRE_PUBLIC_RUNTIME=true
QELLY_PROMPT2C_PUBLIC_BETA=true
QELLY_STATIC_VISUAL_PREVIEW=false
QELLY_PUBLIC_BASE_PATH=/
QELLY_PUBLIC_SITE_URL=https://<truthful-qelly-project>.pages.dev
QELLY_PUBLIC_API_BASE_URL=
QELLY_PUBLIC_SUPABASE_URL=https://ssdgfgqnjlwzkgukzeef.supabase.co
QELLY_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<existing browser-safe publishable key from project ssdgfgqnjlwzkgukzeef>
QELLY_PUBLIC_RELEASE_SHA=<Cloudflare Pages commit SHA / CF_PAGES_COMMIT_SHA>
QELLY_DEPLOYMENT_ENVIRONMENT=cloudflare-pages-production
QELLY_ENABLE_AUTH=true
QELLY_ENABLE_CLOUD_SYNC=true
QELLY_ENABLE_LIVE_PROVIDERS=true
QELLY_ENABLE_FEEDBACK_WRITES=true
QELLY_ALLOWED_ORIGINS=https://<truthful-qelly-project>.pages.dev
```

The Supabase publishable key is intentionally browser-safe. It is not a service-role credential and remains constrained by Auth and RLS.

## Optional server-only secret

`QELLY_SUPABASE_SERVICE_ROLE_KEY` is optional and must remain in Cloudflare secret storage. Normal Auth, cloud synchronization, saved-calculation lifecycle, feedback and RLS access do not require it. Its only current narrow use is immediate deletion of the Supabase Auth identity after an authenticated deletion request. Without it, deletion remains a recorded request for controlled processing.

Do not expose this value in the browser, build logs, repository, screenshots or support records.

## Optional binding

A `QELLY_RATE_LIMITER` binding may be connected when available on the selected Free configuration. The code also includes a bounded per-isolate sliding-window fallback so abuse controls do not silently disappear when the binding is absent.

## Supabase Auth URLs after the final hostname exists

In the existing project `ssdgfgqnjlwzkgukzeef`, configure:

- Site URL: `https://<truthful-qelly-project>.pages.dev`
- Redirect URL: `https://<truthful-qelly-project>.pages.dev/auth/callback.html`
- Recovery redirect: `https://<truthful-qelly-project>.pages.dev/auth/callback.html?flow=recovery`

Do not add wildcard redirects broader than the exact Pages hostname unless a separately governed preview policy requires them.

## Release proof

Do not declare deployment complete until `qelly-release.json` reports the exact accepted runtime SHA and these values are true:

```json
{
  "mode": "cloudflare-pages-public-runtime",
  "cloudMode": "supabase-cloudflare-facade",
  "authentication": true,
  "cloudSync": true,
  "liveProviders": true,
  "fallbackReleaseSha": "603cece3091dc59cfb72680914e7056b40058022"
}
```
