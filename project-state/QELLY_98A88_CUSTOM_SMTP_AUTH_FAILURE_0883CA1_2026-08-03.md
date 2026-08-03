# Qelly exact-head production acceptance — custom SMTP authentication boundary at 0883ca1

Date: 2026-08-03 IST
Repository: `hemangsah/qelly-intelligence`
Supabase project: `ssdgfgqnjlwzkgukzeef`
Isolated forensic branch: `forensics/qelly-live-auth-98a88`
Controlled trigger commit: `0883ca1f40992d71c0c6eda3f671ec337b5e9b0d`
GitHub Actions run: `30788977351`
Job: `91608368779`

## Protected topology preserved

- Product/release SHA: `98a88d76bbba1017a40012aa2790213af6af485a`
- Fallback SHA: `603cece3091dc59cfb72680914e7056b40058022`
- Main SHA: `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- PR #23: open, draft and unmerged
- PR #25: open, draft and unmerged
- PR #26: open, draft and unmerged at exact product SHA
- No product, release, fallback, main, RLS or CSP mutation occurred.

## Preflight state

Before the controlled attempt:

- Supabase project status: `ACTIVE_HEALTHY`
- Auth users: `0`
- Auth sessions: `0`
- All ten Qelly public application tables: `0` rows
- RLS enabled: `10/10` Qelly tables
- No newer signup/email execution appeared after the prior controlled run.

Live Auth logs confirmed the custom SMTP configuration reload and the email limiter change from `2/1h` to `30`. Configuration reload was not treated as delivery proof.

## Exactly one controlled trigger

Only `.github/workflows/qelly-live-auth-isolation.yml` was changed for the trigger. The harmless marker became:

`# controlled-run-marker: 2026-08-03T06:02:30Z-custom-smtp-single-attempt`

The workflow retained:

- push branch restriction to `forensics/qelly-live-auth-98a88`;
- path restriction to `.github/workflows/qelly-live-auth-isolation.yml`;
- no `pull_request` trigger;
- concurrency group `qelly-live-auth-isolation-98a88`;
- `cancel-in-progress: false`;
- timeout `110` minutes.

The quota-safe runner remained unchanged with blob SHA `7b0f72b21af170e1ef1d89c62207bd941e5a064c`, matching commit `cb14cd72318920c8f13d8d18043818889fb192bc`.

Exactly one workflow run started. No retry or rerun was issued.

## SMTP delivery preflight result

The first disposable registration request reached Supabase Auth at `2026-08-03T06:05:01Z` and stopped before email delivery.

- Disposable actor ID: `c5fc5bf0-5a1b-4049-b72d-27da5bada398`
- Disposable email: `qelly-user-a-msctrcp0-2bdc7b76@web-library.net`
- Request path: `POST /signup`
- Requested callback/referer: `https://qelly-intelligence.pages.dev/auth/callback.html`
- HTTP status: `500`
- Supabase error code: `unexpected_failure`
- Non-secret SMTP error: `535 5.7.8 Username and Password not accepted ... - gsmtp`

No confirmation email was delivered. No confirmation or recovery link was generated. The callback request was production-correct and did not use localhost, but redirect completion could not be tested because SMTP authentication failed first.

This is a custom SMTP authentication/configuration boundary, not evidence of a Qelly product, Auth redirect, RLS or CSP defect.

## GitHub evidence

- Workflow run ID: `30788977351`
- Job ID: `91608368779`
- Job conclusion: `failure`
- Runtime: approximately `36` seconds
- Failing step: `Run temporary-mail Auth, cloud lifecycle and tenant isolation`
- Runner result: `QELLY_LIVE_AUTH_VERIFICATION_FAILED:500`
- Evidence upload step: success

Evidence artifact:

- Artifact ID: `8846316771`
- Name: `qelly-live-auth-isolation-98a88d7`
- GitHub size: `405070` bytes
- SHA-256: `801d5a16dee511010cd073498ee3746122338ff1653e68abf16e16f12d4cdc88`
- ZIP CRC: clean
- Entries: `result.json`, `user-a-registration.png`, `cleanup-user-ids.json`
- Result blocker: HTTP `500`
- `cleanup-user-ids.json`: empty user-ID list
- Screenshot contains the blank registration form only; no password, token, credential or confirmation link.

## Exact cleanup and post-run state

The failed signup did not persist an `auth.users` row for the exact disposable ID or email. Therefore no destructive deletion was required.

Post-run verification:

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

## Gate status

The acceptance stopped exactly at the required SMTP-delivery preflight. The following remain unexecuted and unclaimed in this attempt:

- user A and user B confirmation completion;
- login, logout, session restoration and refresh;
- recovery and password update;
- profile/workspace bootstrap;
- cloud and saved-calculation lifecycle;
- offline replay/conflict handling;
- deployed two-user tenant isolation;
- account export/deletion;
- provider/security/UI/accessibility/performance/SEO/PWA/rollback continuation;
- `QELLY_COMPLETE_FRONTEND_ALL_SCREENS_MASTER_PUBLIC_RUNTIME.pdf`;
- final public-runtime manifests and scorecard.

The immutable 436-page predeployment PDF remains preserved.

## Required next action

Correct the custom SMTP authentication settings in the Supabase dashboard using the provider's currently valid authentication method. For Gmail SMTP, this generally means a valid SMTP username plus a provider-authorized app password or equivalent account policy, not an ordinary rejected password. Do not place credentials in GitHub, chat, logs or repository files.

After the dashboard configuration is corrected and Auth reload is visible, begin a new continuation from this handoff, reverify zero-state, and trigger exactly one new workflow-only acceptance attempt. Do not rerun `30788977351` and do not perform duplicate signup retries against the known-bad configuration.
