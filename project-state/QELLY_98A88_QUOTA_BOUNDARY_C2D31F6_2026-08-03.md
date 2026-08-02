# Qelly exact-head production acceptance — quota boundary at c2d31f6

Date: 2026-08-03 IST
Repository: `hemangsah/qelly-intelligence`
Isolated forensic branch: `forensics/qelly-live-auth-98a88`
Workflow trigger commit: `c2d31f6b6c0d572a1b0c516310b17364b123025b`

## Protected topology reverified before the run

- Product/release SHA: `98a88d76bbba1017a40012aa2790213af6af485a`
- Fallback SHA: `603cece3091dc59cfb72680914e7056b40058022`
- Main SHA: `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- PR #23: open, draft, unmerged
- PR #25: open, draft, unmerged
- PR #26: open, draft, unmerged at exact product SHA
- No product, release, main, RLS or CSP mutation occurred.

## Workflow-only trigger

`.github/workflows/qelly-live-auth-isolation.yml` remained restricted to:

- branch `forensics/qelly-live-auth-98a88`;
- path `.github/workflows/qelly-live-auth-isolation.yml`;
- no `pull_request` trigger;
- concurrency group `qelly-live-auth-isolation-98a88`;
- `cancel-in-progress: false`;
- timeout `110` minutes.

The only content change was the controlled run marker `2026-08-02T19:00:02Z`.
The accepted quota-safe runner remained unchanged at commit `cb14cd72318920c8f13d8d18043818889fb192bc`.

## Fresh production evidence

User A synthetic identity:

- User ID: `eb9dd2f3-5406-4df0-ae5b-b3de43523214`
- Signup accepted at `2026-08-02T19:02:03Z`
- Confirmation email sent at `2026-08-02T19:02:03Z`
- Signup referer: `https://qelly-intelligence.pages.dev/auth/callback.html`
- Verification completed at `2026-08-02T19:02:08Z`
- Verification status: HTTP `303`
- Verification referer: `https://qelly-intelligence.pages.dev/auth/callback.html`
- Implicit login/session issued at `2026-08-02T19:02:08Z`
- No localhost observed in the fresh accepted flow.

User B attempted after the runner's 65-second serialization:

- Synthetic attempted actor ID: `4f9db071-3823-4cb1-9624-38ac53d8112f`
- Attempt time: `2026-08-02T19:03:24Z`
- Requested referer: `https://qelly-intelligence.pages.dev/auth/callback.html`
- Supabase response: HTTP `429`
- Error code: `over_email_send_rate_limit`
- No user-B row remained in `auth.users`.
- No localhost observed.

This proves the current built-in hosted SMTP project quota does not permit the second required confirmation email after only 65 seconds, even though the endpoint's per-address cooldown is satisfied. This is an external hosted-email quota boundary, not a Qelly product, redirect, RLS or CSP defect.

## Exact cleanup

Only the exact synthetic user-A row was deleted after verifying its ID and email. User B had no persisted Auth row.

Post-cleanup state:

- Auth users: `0`
- Auth sessions: `0`
- Profiles: `0`
- Workspaces: `0`
- Workspace members: `0`
- Saved calculations: `0`
- Revisions: `0`
- Sync operations: `0`
- Feedback: `0`
- Account deletion requests: `0`
- Audit events: `0`
- Provider cache: `0`

No legitimate user or application row was removed.

## Next safe action

Do not burst-retry. Resume only after a later rolling quota window. Trigger exactly one workflow-only run. Keep all protected refs and PR states unchanged. If the hosted SMTP quota again prevents the second confirmation, preserve evidence, clean exact disposable identities, and report that a dedicated production SMTP provider is required to complete a three-email acceptance matrix without multi-hour serialization.
