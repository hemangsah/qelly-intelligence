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

## Fresh accepted confirmation checkpoint

Supabase Auth logs at `2026-08-02T17:50:01Z–17:50:07Z` prove:

- registration accepted;
- confirmation email sent;
- confirmation verification returned HTTP 303;
- implicit login/session issuance succeeded;
- signup referer: `https://qelly-intelligence.pages.dev/auth/callback.html`;
- verification referer: `https://qelly-intelligence.pages.dev/auth/callback.html`;
- localhost observed in the fresh flow: no.

The accepted user bootstrapped exactly one profile and one workspace.

## Hosted SMTP boundary

After the intentional 65-second spacing, user B signup at `2026-08-02T17:51:25Z` returned:

- HTTP `429`;
- error code `over_email_send_rate_limit`;
- requested referer `https://qelly-intelligence.pages.dev/auth/callback.html`;
- localhost observed: no.

This proves the hosted project currently allows fewer than the three Auth emails needed for the complete matrix in a single rolling window. It is an external built-in SMTP quota boundary, not a redirect, RLS, CSP or product defect. Auth confirmation was not disabled and no burst retry or secret request was performed.

## Exact cleanup

The only committed synthetic identity was:

- user ID `b4caa743-5dc5-42fd-826a-21bd0904586f`;
- synthetic address `qelly-user-a-msc3i44l-4f9e27f6@web-library.net`.

It was deleted by exact ID and exact address. Post-cleanup SQL returned zero:

- disposable Auth users and sessions;
- profiles, workspaces and workspace members;
- saved calculations and revisions;
- sync operations;
- feedback and deletion requests;
- audit events and provider cache rows.

## Remaining gates

- user B confirmation;
- login/logout/session restoration/refresh;
- cloud lifecycle and saved-calculation lifecycle;
- sync replay/conflict;
- direct and API cross-tenant isolation;
- recovery redirect/password update;
- account export/deletion;
- final authenticated quality sweep;
- public-runtime PDF, manifests, checksums and scorecard.

A later controlled run must begin outside the latest successful confirmation-email rolling window and must not overlap another Auth verifier.
