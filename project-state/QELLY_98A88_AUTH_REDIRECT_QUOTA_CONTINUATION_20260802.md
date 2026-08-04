# Qelly 98a88 live Auth redirect verification and quota-safe continuation

Generated UTC: 2026-08-02T16:49:57Z

## Immutable product topology

- Repository: `hemangsah/qelly-intelligence`
- Main: `9cb98780893924ad26fbf4baaa9048e80a162b2c` — unchanged
- Authoritative deployed product SHA: `98a88d76bbba1017a40012aa2790213af6af485a`
- Deterministic fallback: `603cece3091dc59cfb72680914e7056b40058022`
- PR #23: open, draft, unmerged
- PR #25: open, draft, unmerged
- PR #26: open, draft, unmerged at exact product SHA `98a88d76bbba1017a40012aa2790213af6af485a`

No product source, release branch, checkpoint, main, RLS or CSP was changed in this continuation.

## Fresh hosted Auth URL proof

Supabase project: `ssdgfgqnjlwzkgukzeef`

Fresh production events after the account-side URL update prove:

- signup confirmation request referer: `https://qelly-intelligence.pages.dev/auth/callback.html`
- successful `/verify` referer: `https://qelly-intelligence.pages.dev/auth/callback.html`
- verification response: HTTP 303
- implicit login: successful
- confirmation page: successful
- account/session page: rendered
- no localhost was used by the accepted fresh confirmation flow

The first retry exposed only a forensic temporary-mail parser defect that retained a trailing `]`. The parser was corrected on the isolated forensic branch; the product runtime was not changed.

## Fresh Auth evidence

Controlled run:

- workflow run: `30757224014`
- job: `91521371179`
- artifact: `8836311618`
- artifact bytes: `827753`
- artifact SHA-256: `2f5cdae4ea93b89d46a849e723ad47444335c4236d0c04e4bd5997dcabb0acc0`
- forensic harness commit: `85e687aa7f74da617de1452a51996b3239d7d786`

Accepted from this run:

- exact release and fallback identity
- registration route and valid registration for disposable user A
- confirmation email requested and sent
- confirmation destination on the Qelly production hostname
- successful confirmation and implicit session issuance
- profile bootstrap: 1/1
- workspace bootstrap: 1/1 (`My Qelly Workspace`)
- owner membership row is intentionally unnecessary: `qelly_private.workspace_role` derives `owner` directly from `qelly_workspaces.owner_id`

## Genuine external blocker

The next disposable signup was rejected by Supabase Auth with:

- HTTP 429
- `over_email_send_rate_limit`
- referer still correctly set to `https://qelly-intelligence.pages.dev/auth/callback.html`

This is the built-in hosted SMTP quota, not a Qelly product, redirect, RLS or CSP failure. No burst retries, Auth weakening, email-confirmation disabling or paid SMTP work was performed.

## Cleanup

Exact synthetic IDs were handled individually. Post-cleanup state:

- Auth users: 0
- Auth sessions: 0
- profiles: 0
- workspaces: 0
- workspace memberships: 0
- saved calculations: 0
- revisions: 0
- sync operations: 0
- feedback: 0
- account-deletion requests: 0
- audit events: 0
- provider cache: 0

No legitimate user was deleted.

## Quota-safe forensic continuation

The isolated branch `forensics/qelly-live-auth-98a88` now contains:

- workflow paused to `workflow_dispatch` only, with concurrency protection: `ac2876d204ac375a2cc3bff137b830dc6d62e390`
- quota-serialized runner: `b15699ce95c608aae46480deb4fd31237d43f426`

The runner now:

1. normalizes temporary-mail links;
2. records cleanup IDs immediately;
3. waits 65 seconds between disposable user signups;
4. completes login/session/cloud/isolation before requesting the third email for recovery;
5. waits 65 seconds before recovery;
6. uploads redacted evidence on success or failure.

Exactly one continuation is scheduled after the current quota window. Duplicate push/PR-triggered Auth runs are disabled.

## Non-email gates preserved at exact product head

- Cloudflare Analytics/CSP: passed; no beacon injection/request/violation; `script-src 'self'` preserved
- security scan, typecheck, lint, design validation, calculation contracts, complete repository suite and build: passed in run `30750473851`
- corrective browser matrix: all jobs passed
- canonical public runtime: exact release, health, readiness, provider truth, protected-route denial and zero browser errors/overflow passed in run `30750855606`
- SEO/PWA static evidence: production canonical, description, Open Graph metadata, robots, sitemap, manifest/icons, registered service worker and offline shell present; no localhost or Cloudflare Insights string in the built runtime
- Supabase advisors: no error-level findings; provider cache is RLS-enabled with no client policy by design (server-only deny-all); unused-index notices are informational on the zero-traffic database

## Still gated

The following are not yet claimed complete:

- recovery redirect and password update
- full login/logout/refresh/session matrix result package
- complete cloud saved-calculation lifecycle
- offline replay/conflict matrix
- deployed two-user cross-tenant isolation
- account export/deletion
- final authenticated responsive/accessibility/performance sweep
- final public-runtime PDF and final scorecard

The PDF must not be generated until all mandatory live Auth, sync and isolation gates pass.
