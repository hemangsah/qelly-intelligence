# Qelly exact-head production acceptance — Google App Password rejected at 13601ad

Date: 2026-08-03 IST
Repository: `hemangsah/qelly-intelligence`
Supabase project: `ssdgfgqnjlwzkgukzeef`
Forensic branch: `forensics/qelly-live-auth-98a88`
Controlled trigger commit: `13601ad53e26a43a3fbd11a9b1651c8b0cdf1087`
GitHub Actions run: `30789665888`
Job: `91610357345`

## Protected topology preserved

- Product/release SHA: `98a88d76bbba1017a40012aa2790213af6af485a`
- Fallback SHA: `603cece3091dc59cfb72680914e7056b40058022`
- Main SHA: `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- PR #23: open, draft and unmerged
- PR #25: open, draft and unmerged
- PR #26: open, draft and unmerged at the exact product SHA
- No product, release, main, RLS or CSP mutation occurred.

## Fresh configuration reload and clean preflight state

Before the controlled attempt, Supabase Auth logs showed fresh API configuration reloads after the rejected Gmail credential was replaced, including reloads at:

- `2026-08-03T06:14:40Z`
- `2026-08-03T06:15:50Z`
- `2026-08-03T06:15:53Z`
- `2026-08-03T06:15:57Z`

The project remained `ACTIVE_HEALTHY`.

Preflight database state:

- Auth users: `0`
- Auth sessions: `0`
- all ten Qelly public application tables: `0` rows
- Qelly tables with RLS enabled: `10/10`

A configuration reload was not treated as proof of SMTP authentication or delivery.

## Exactly one workflow-path trigger

Only `.github/workflows/qelly-live-auth-isolation.yml` was updated, changing the harmless marker to:

`# controlled-run-marker: 2026-08-03T06:17:00Z-google-app-password-single-preflight`

The workflow retained:

- push branch restriction to `forensics/qelly-live-auth-98a88`;
- path restriction to `.github/workflows/qelly-live-auth-isolation.yml`;
- no `pull_request` trigger;
- concurrency group `qelly-live-auth-isolation-98a88`;
- `cancel-in-progress: false`;
- timeout `110` minutes.

The accepted runner remained unchanged with blob SHA `7b0f72b21af170e1ef1d89c62207bd941e5a064c`.

Exactly one workflow run started. No rerun, failed-job rerun, manual dispatch or duplicate signup attempt was issued.

## Disposable SMTP delivery preflight

The first disposable signup reached Supabase Auth at `2026-08-03T06:17:25Z`.

- Disposable actor ID: `9b46ed26-6833-467d-8b0b-76db5efe8047`
- Disposable email: `qelly-user-a-mscu7b2j-da6a6e53@web-library.net`
- Request: `POST /signup`
- Requested callback/referer: `https://qelly-intelligence.pages.dev/auth/callback.html`
- HTTP status: `500`
- Supabase error code: `unexpected_failure`
- Non-secret Gmail SMTP error class: `535 5.7.8 Username and Password not accepted ... - gsmtp`

Gmail rejected SMTP authentication before confirmation-email delivery. No confirmation email, confirmation link, recovery email or recovery link was generated. The requested callback was production-correct and did not use localhost, but redirect completion could not be exercised because delivery never began.

This second controlled rejection occurred after a newly generated Google App Password was saved and fresh Auth reloads were observed. Per the acceptance boundary, no further Gmail SMTP retry is permitted. A dedicated transactional SMTP provider is now required before the Auth acceptance matrix can continue.

## GitHub and artifact evidence

- Workflow run ID: `30789665888`
- Job ID: `91610357345`
- Job conclusion: `failure`
- Runtime: approximately `44` seconds
- Failing step: `Run temporary-mail Auth, cloud lifecycle and tenant isolation`
- Runner result: `QELLY_LIVE_AUTH_VERIFICATION_FAILED:500`
- Evidence upload step: success

Evidence artifact:

- Artifact ID: `8846560699`
- Name: `qelly-live-auth-isolation-98a88d7`
- Size: `405070` bytes
- SHA-256: `974ba7893e22c85c63b9045c3c6c5599cd35a0e5edf3ba15642acf888aec0a51`
- ZIP CRC: clean
- Entries: `result.json`, `cleanup-user-ids.json`, `user-a-registration.png`
- `cleanup-user-ids.json`: empty user-ID list
- Screenshot: empty registration form only; no entered email, password, token, SMTP credential or confirmation link
- Internal file SHA-256 values:
  - `cleanup-user-ids.json`: `6713356aacf8f2346876e1778f103c1a694d797085338de81992556c2e247882`
  - `result.json`: `d30ad5b2c36b584eb853c92bfd6510231930c872dddff43e146cdaf20bf326eb`
  - `user-a-registration.png`: `8cd96a7f5777b02339449ed277aeed8d808e450415899a4e15694e011fdf2c96`

## Exact cleanup and final zero-state

The failed signup did not persist an Auth user. The exact disposable actor ID and email both returned zero retained rows, so no destructive deletion was required.

Final verification:

- Exact disposable users: `0`
- Auth users: `0`
- Auth sessions: `0`
- `qelly_profiles`: `0`
- `qelly_workspaces`: `0`
- `qelly_workspace_members`: `0`
- `qelly_saved_calculations`: `0`
- `qelly_saved_calculation_revisions`: `0`
- `qelly_sync_operations`: `0`
- `qelly_feedback`: `0`
- `qelly_account_deletion_requests`: `0`
- `qelly_audit_events`: `0`
- `qelly_provider_cache`: `0`
- RLS enabled: `10/10` Qelly tables

No legitimate identity or application row was removed.

## Terminal gate decision

Stop all Gmail SMTP acceptance retries. Do not rerun `30789665888` or create another disposable signup against Gmail SMTP.

Configure a dedicated transactional SMTP provider in the existing Supabase project without exposing credentials. After its configuration reload is visible, start a separately authorized continuation from this handoff with one disposable delivery preflight, followed by the existing exact-head Auth, cloud-sync, two-user isolation, recovery, cleanup and public-runtime acceptance only if delivery succeeds.

Until then, the following remain unexecuted and unclaimed:

- user A and user B confirmation completion;
- invalid and valid login, logout, session restoration and refresh;
- recovery and password update;
- profile/workspace bootstrap;
- cloud synchronization and saved-calculation lifecycle;
- offline queue, replay and conflict handling;
- deployed two-user cross-tenant isolation;
- account export and deletion;
- provider/security/responsive/accessibility/performance/SEO/PWA/rollback continuation;
- `QELLY_COMPLETE_FRONTEND_ALL_SCREENS_MASTER_PUBLIC_RUNTIME.pdf`;
- final public-runtime manifests, checksums and scorecard.

The immutable 436-page predeployment PDF remains preserved.
