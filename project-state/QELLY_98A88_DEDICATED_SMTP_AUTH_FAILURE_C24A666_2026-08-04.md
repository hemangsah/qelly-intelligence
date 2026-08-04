# Qelly 98a88 — Dedicated SMTP authentication failure closeout

## Controlled attempt

Exactly one isolated forensic push triggered the existing production Auth acceptance harness.

- forensic branch: `forensics/qelly-live-auth-98a88`
- obsolete built-in-sender delay removal: `1bbc00f7cdff9a2ea9e9a5da43493247d41bd849`
- controlled trigger commit: `c24a66690c89ae958c36864decca3849793d56c1`
- workflow run: `30904310573`
- job: `91975682964`
- conclusion: failure after 47 seconds
- duplicate attempt: none

No product, main, production release, checkpoint, fallback, Supabase schema, migration, RLS, CSP or Vercel state was modified.

## Runtime gates passed before SMTP

The redacted artifact proved:

- production release SHA: `98a88d76bbba1017a40012aa2790213af6af485a`
- deterministic fallback SHA: `603cece3091dc59cfb72680914e7056b40058022`
- authentication, cloud synchronization, live-provider and protected-write capability flags: true
- public site: `https://qelly-intelligence.pages.dev`
- modern Supabase publishable-key shape: valid
- publishable key was not the project reference
- requested callback: `https://qelly-intelligence.pages.dev/auth/callback.html`
- localhost observed: no

## Exact SMTP outcome

At `2026-08-04T11:19:52Z`, Supabase Auth processed one controlled signup request and returned HTTP `500` before delivery.

Non-secret error class:

`535 5.7.8 Authentication failed`

This proves that saving and reloading the SMTP configuration did not prove provider delivery. No confirmation email was received, no duplicate signup was issued and execution stopped at the required boundary.

Current blocker:

`DEDICATED_TRANSACTIONAL_SMTP_PROVIDER_AUTHENTICATION_REQUIRED`

## Artifact

- artifact ID: `8890391529`
- name: `qelly-live-auth-isolation-98a88d7`
- bytes: `405070`
- SHA-256: `1325872549811ec16f65c0858fa8347b054976f2d0ab29a89d55fd2882c950ea`
- entries: `3`
- ZIP CRC: clean
- contents: redacted result JSON, cleanup-user-IDs JSON and the pre-signup registration screenshot

The artifact contains no persisted password, confirmation link, mailbox token, Supabase session token or service-role credential.

## Cleanup truth

Live database verification after the failure:

- Auth users: `0`
- Auth sessions: `0`
- all ten Qelly application/provider-cache tables: `0` rows
- RLS: enabled on `10/10` public Qelly tables
- public policies: `27`
- migrations: unchanged at exactly two

No disposable Auth identity or application row remains.

Mailbox cleanup limitation: the artifact reports `userA=false` for mailbox deletion because the signup exception occurred before the created mailbox was returned to the outer cleanup scope. Mailbox credentials were intentionally kept only in process memory and were not persisted, so deletion of that remote temporary mailbox cannot now be proved. User B was never created. This limitation is recorded rather than hidden.

## Protected topology

- `main`: unchanged at `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- production release branch: unchanged at `98a88d76bbba1017a40012aa2790213af6af485a`
- restoration checkpoint: unchanged at `98a88d76bbba1017a40012aa2790213af6af485a`
- PR #23, #25, #26 and #33: open, draft and unmerged
- Vercel: not used; zero projects

## Readiness separation

- protected topology: `100%`
- Supabase static state and database cleanup: `100%`
- SMTP delivery: `0%`
- live registration/confirmation/login/recovery: `0%`
- cloud saved-calculation lifecycle: `0%`
- deployed two-user tenant isolation: `0%`
- final public-runtime PDF: `0%`, correctly gated

## Next exact boundary

The owner must correct the dedicated transactional SMTP provider authentication settings directly in the existing Supabase project. Do not paste the SMTP password, API key or token into chat.

After a fresh Supabase Auth configuration reload is visible, run exactly one new disposable delivery preflight. Do not retry before that configuration correction and reload.
