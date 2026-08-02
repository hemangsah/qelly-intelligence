# Qelly Absolute-Final Production Auth URL Gate

Observed UTC: `2026-08-02T03:06:36.147Z`

## Fresh production result

A secret-safe externally hosted probe ran against:

- public URL: `https://qelly-intelligence.pages.dev`
- exact release: `150025b9662404e5f98cd397c74c5d8be386460c`

Result:

- release identity: exact;
- registration HTTP status: `202`;
- verification required: `true`;
- confirmation email received: `true`;
- Supabase verification HTTP status: `303`;
- access-token presence after verification: `true`;
- refresh-token presence after verification: `true`;
- observed redirect origin: `http://localhost:3000`;
- observed redirect path: `/`;
- expected redirect origin: `https://qelly-intelligence.pages.dev`;
- expected redirect path: `/auth/callback.html`;
- callback correct: `false`;
- disposable mailbox deleted: `true`.

No email address, password, confirmation link, access token, refresh token or publishable-key value is stored here.

## Workflow evidence

- workflow: `Qelly Absolute-Final Auth URL Probe`
- run: `30730042036`
- job: `91448588511`
- forensic branch head: `4ef319033d3af8d9e9a2feefb0b9fac8403c19d6`
- evidence artifact: `8827638320`
- artifact bytes: `670`
- artifact SHA-256: `a44c10dbf39270edbaf48c2ef1ea5af89144b4ec5277812d8880c66c95265128`
- artifact expiration: `2026-08-05T03:06:47Z`

The job's non-success conclusion is expected: the probe exits nonzero only when the production confirmation callback does not match the required Cloudflare callback.

## Cleanup proof

The single controlled Auth identity created at `2026-08-02T03:06:38Z` was deleted through the connected Supabase database capability after evidence capture.

Post-cleanup counts:

- Auth users: `0`;
- Auth sessions: `0`;
- profiles: `0`;
- workspaces: `0`;
- workspace members: `0`;
- saved calculations: `0`;
- saved revisions: `0`;
- sync operations: `0`;
- feedback: `0`;
- account deletion requests: `0`;
- audit events: `0`;
- provider-cache rows: `0`.

No migration, schema, trigger, policy, function or RLS change was performed.

## Exact account-side action

The connected Supabase tools do not expose a hosted Auth URL Configuration write action. Set these values in the existing hosted project:

- Site URL: `https://qelly-intelligence.pages.dev`
- redirect: `https://qelly-intelligence.pages.dev/auth/callback.html`
- recovery redirect: `https://qelly-intelligence.pages.dev/auth/callback.html?flow=recovery`

Do not add a broad production wildcard. After saving, rerun the prepared live matrix. Until this is done, production Auth, cloud synchronization, two-user tenant isolation and the final public-runtime PDF cannot be truthfully accepted.