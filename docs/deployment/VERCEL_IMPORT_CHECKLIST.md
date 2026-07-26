# Vercel Static Frontend Import

Vercel receives only the static Qelly frontend. The Node API, SSE endpoints, worker, Redis consumer, migrations, backup/restore jobs, and ClamAV remain on persistent or one-shot container infrastructure.

## Project settings

- Repository: `hemangsah/qelly-intelligence`
- Root: repository root
- Framework: Other
- Node: 22.x
- Install: `npm ci --ignore-scripts`
- Build: `npm run build:frontend`
- Output: `dist/frontend` (also declared in `vercel.json`)
- Required build variable: `QELLY_PUBLIC_API_BASE_URL=https://<verified-api-preview-host>`

Add the exact Vercel preview origin to the API's `QELLY_FRONTEND_ORIGINS` and `QELLY_WEBAUTHN_ORIGINS`. The API uses credentialed CORS, session-bound CSRF, and `SameSite=None; Secure` cookies. Verify authentication in browsers that match the intended preview audience; a final shared parent domain is preferred because third-party-cookie policies can affect unrelated preview domains.

Do not create a Vercel API function for the persistent server or worker. Do not run migrations during a Vercel build or cold start.
