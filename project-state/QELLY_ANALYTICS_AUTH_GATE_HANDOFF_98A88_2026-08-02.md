# Qelly Analytics/CSP and Auth Acceptance Handoff

Generated: `2026-08-02T14:03:14.025930+00:00`

## Accepted topology

- Authoritative corrective SHA: `98a88d76bbba1017a40012aa2790213af6af485a`
- Release branch: `release/qelly-global-public-beta`
- Immutable checkpoint: `checkpoint/prompt2c-production-restoration-98a88d`
- Deterministic fallback: `603cece3091dc59cfb72680914e7056b40058022`
- Main: `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- PR #23, #25 and #26 remain open, draft and unmerged.

## Cloudflare Web Analytics and CSP

The deployed edge is accepted at exact SHA `98a88d76bbba1017a40012aa2790213af6af485a`.

Canonical evidence:

- run `30750855606`
- job `91504532276`
- artifact `8834393831`
- artifact SHA-256 `49490f4113ed2d1982bd775edc538927cc96ca7373306df5b7b0078bdb82abda`

Verified:

- no `static.cloudflareinsights.com`
- no `beacon.min.js`
- no `cloudflareinsights`
- no related CSP violation
- no console, page or API failures in the canonical browser probes
- `script-src 'self'` remains unchanged
- release SHA and deterministic fallback are exact

The workflow's overall red result was caused only by the post-verification PR-comment script after evidence upload, not by Qelly.

## Commit classification after 614f6ed

No accidental product commit was found. `98a88d76…` is the valid newer corrective head and must not be replaced by blindly redeploying `614f6ed…`.

1. `ba4c19d455c5958804150ee280c36f12b44d4039` — product/runtime corrective.
2. `f9b5083704199d02234611cc8f5b1430ae6d6118` — workflow-only.
3. `f516e442a7450b08c861c4139cf671a6a5e08f4b` — workflow-only.
4. `3414e5050816d71f57750f1ffd668e0991e8be76` — build/configuration corrective.
5. `090e8dbd3f47837b28a66fef00c94926d5b1941c` — product/runtime corrective.
6. `2562c63f68d6426879a578b87212bc0a2f102589` — product/runtime corrective.
7. `7104b3aaa4bb0177310cf95a48fa948d06c4fae0` — workflow-only; no patch job executed.
8. `98a88d76bbba1017a40012aa2790213af6af485a` — workflow cleanup.

## Supabase

Project `ssdgfgqnjlwzkgukzeef` is `ACTIVE_HEALTHY` in `ap-south-1`.

- migrations: unchanged
- public tables: 10
- RLS: 10/10
- policies: 27
- Auth users/sessions after cleanup: 0/0
- retained application/provider-cache rows: 0

Fresh live Auth evidence:

- run `30751019280`
- job `91504957788`
- artifact `8834446497`
- artifact SHA-256 `a0e6c810acea91b5d56bb8f0f73fd97d88c85c121ab8e434388607a23f073132`

Registration, confirmation email and implicit verification were reached, but Supabase still recorded `http://localhost:3000` as the confirmation referer. The production callback, cloud synchronization and deployed two-user isolation were therefore not accepted.

## Exact remaining account-side action

`SUPABASE_AUTH_URL_CONFIGURATION_REQUIRED`

Open:

**Supabase Dashboard → project `ssdgfgqnjlwzkgukzeef` → Authentication → URL Configuration**

Set:

- Site URL: `https://qelly-intelligence.pages.dev`
- Redirect URL: `https://qelly-intelligence.pages.dev/auth/callback.html`
- Recovery redirect: `https://qelly-intelligence.pages.dev/auth/callback.html?flow=recovery`

Remove/disallow localhost for production. Do not add a broad wildcard.

After saving, reply:

`done`

The public-runtime PDF remains intentionally ungenerated until live Auth, cloud synchronization and deployed two-user isolation pass. The immutable 436-page predeployment PDF remains preserved.
