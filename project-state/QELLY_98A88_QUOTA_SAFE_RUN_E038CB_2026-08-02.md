# Qelly 98a88 quota-safe production acceptance run

## Immutable topology

- Product/release: `98a88d76bbba1017a40012aa2790213af6af485a`
- Fallback: `603cece3091dc59cfb72680914e7056b40058022`
- Main: `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- PR #23, #25 and #26: open, draft and unmerged at launch
- Supabase project: `ssdgfgqnjlwzkgukzeef`

## Controlled run

- Isolated branch: `forensics/qelly-live-auth-98a88`
- Workflow-only trigger commit: `e038cb49779868f4a47ca655a7ed21f0fd404137`
- Workflow timeout: 110 minutes
- Push path restriction: `.github/workflows/qelly-live-auth-isolation.yml`
- Pull-request trigger: absent
- Concurrency cancellation: disabled
- Product source changed: no
- RLS/CSP changed: no

## Launch zero-state

Before triggering the run, exact SQL returned zero disposable Auth users, zero disposable sessions and zero rows in all Qelly application/provider tables.

## Fresh accepted checkpoint

Supabase Auth logs at `2026-08-02T17:50:01Z–17:50:07Z` prove:

- registration accepted;
- confirmation email sent;
- confirmation verification returned HTTP 303;
- implicit login/session issuance succeeded;
- signup referer: `https://qelly-intelligence.pages.dev/auth/callback.html`;
- verification referer: `https://qelly-intelligence.pages.dev/auth/callback.html`;
- localhost observed in the fresh flow: no.

Current controlled state at the first checkpoint:

- disposable Auth users: 1;
- confirmed users: 1;
- profiles: 1;
- workspaces: 1;
- saved calculations/revisions/sync operations: 0.

The runner is intentionally waiting 65 seconds before creating user B and later waits 3,900,000 ms before recovery to remain outside the built-in SMTP rolling quota. Do not launch another run or delete the active controlled identity while this workflow is running.

## Remaining gates

- user B confirmation;
- login/logout/session restoration/refresh;
- cloud lifecycle and saved-calculation lifecycle;
- sync replay/conflict;
- direct and API cross-tenant isolation;
- recovery redirect/password update;
- account export/deletion;
- exact cleanup;
- final authenticated quality sweep;
- public-runtime PDF, manifests, checksums and scorecard.
