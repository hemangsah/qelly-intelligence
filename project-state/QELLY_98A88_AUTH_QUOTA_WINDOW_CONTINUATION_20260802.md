# Qelly 98a88 — Auth quota-window continuation

## Protected topology

- Product/release SHA: `98a88d76bbba1017a40012aa2790213af6af485a`
- Deterministic fallback: `603cece3091dc59cfb72680914e7056b40058022`
- Main: `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- PR #23, #25 and #26 remain open, draft and unmerged.

## Fresh retry evidence

A single controlled forensic push ran after the user confirmed the hosted Supabase URL settings.

- workflow commit: `8d55b85cf2eb82fa8aef72f6e0200b10f440b661`
- run: `30758124849`
- job: `91523762844`
- artifact: `8836582074`
- artifact SHA-256: `cc94b6d134ace79a0e51010014e87b75239a5541467558f935b4f089c59eb8b0`
- artifact bytes: `405070`
- observed at: `2026-08-02T17:06:46.570Z`
- release/fallback/capability/key-shape checks: passed
- signup result: `429 over_email_send_rate_limit`
- requested redirect: `https://qelly-intelligence.pages.dev/auth/callback.html`
- localhost observed: no

Supabase Auth logs independently record the same `429` at `2026-08-02T17:06:52Z` with the correct Qelly production callback.

## Cleanup

After the failed request:

- Auth users/sessions: `0/0`
- profiles/workspaces/members/calculations/revisions/sync/feedback/deletion/audit/provider-cache rows: all `0`
- synthetic users: none

## Quota-safe design

Supabase's built-in hosted sender has demonstrated a rolling two-email window. The disposable verifier now:

1. creates and confirms user A;
2. waits 65 seconds;
3. creates and confirms user B;
4. completes login/logout/refresh, cloud lifecycle and two-user isolation;
5. keeps both browser sessions and temporary mailboxes in-memory only;
6. waits 65 minutes;
7. requests and verifies recovery for user A;
8. completes password update, account deletion and cleanup.

The runner change is isolated to forensic commit:

`cb14cd72318920c8f13d8d18043818889fb192bc`

No Qelly product, main, release, checkpoint, migration, RLS or CSP file changed.

## Next controlled execution

One exact continuation is scheduled for `2026-08-02T23:20:00+05:30`. It must update only the forensic workflow to a timeout of at least 100 minutes and trigger exactly one push run. No pull-request trigger or duplicate run is permitted.
