# Qelly Absolute-Final Live-State Ledger

Observed UTC: `2026-08-02T03:04:36.053248+00:00`

This is the required delta-only pre-mutation ledger for the absolute-final public-runtime acceptance wave. It records live evidence before any product, release, database, Auth, UI, PDF or deployment change.

## Repository topology

- Repository: `hemangsah/qelly-intelligence`
- `main`: exactly `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- PR #23: open, draft, mergeable, unmerged; head `17eeadac4c510cc3c312185e86b0ac5907f3789b`
- PR #25: open, draft, mergeable, unmerged; head `150025b9662404e5f98cd397c74c5d8be386460c`
- Prompt 2C feature branch: exactly `150025b9662404e5f98cd397c74c5d8be386460c`
- Release branch `release/qelly-global-public-beta`: exactly `150025b9662404e5f98cd397c74c5d8be386460c`
- Checkpoint `checkpoint/prompt2c-public-runtime-150025b`: exactly `150025b9662404e5f98cd397c74c5d8be386460c`
- Original `5213928...` checkpoint and deterministic fallback `603cece3091dc59cfb72680914e7056b40058022` remain preserved.
- Repository auto-merge remains disabled.

No product or configuration commit exists after `150025b...` on the Prompt 2C feature, release or current checkpoint refs.

Forensic-only branches are isolated from the accepted release:

- `forensics/qelly-final-verifier-150025b`: one workflow-only commit;
- `forensics/qelly-live-auth-150025b`: eight workflow/harness-only commits;
- `forensics/qelly-pages-blank-20260802`: historical blank-page workflow/forensics branch diverged from the original `5213928...` lineage.

## Canonical acceptance and artifacts

Canonical production gate:

- run `30715389847`;
- validation job `91409986845`: success;
- exact ancestry/fallback, secret scan, typecheck, lint, design validation, focused tests, complete repository tests, Pages Functions checks and exact public build: success;
- external verifier was skipped in that canonical feature-head run.

Accepted runtime artifact:

- ID `8823173218`;
- exact head `150025b9662404e5f98cd397c74c5d8be386460c`;
- bytes `477398`;
- digest `sha256:590b3118e3e1a9ff6f9b55d1ed1bdf475a3fbe9abfc9d65bf49a5f38066774bc`;
- unexpired.

Release-branch external run `30715444500` proved the exact release/config/critical HTTP routes. Its browser assertion failed only because Cloudflare's optional analytics beacon was injected and blocked by Qelly's strict `script-src 'self'`; Qelly rendered and strict CSP was not weakened. Evidence artifact `8823199532`, digest `sha256:ba40665e96ce5fa8de7b0fef8c2e3611298cffcc63e965f10b52d08e4474802f`.

## Cloudflare

Strongest official evidence available in this execution context is the Cloudflare GitHub integration plus externally hosted GitHub Actions verification.

- Pages project: `qelly-intelligence`
- public URL: `https://qelly-intelligence.pages.dev`
- production branch: `release/qelly-global-public-beta`
- accepted deployment ID: `cd20f2a9-1ff6-46b4-ae23-bc4df9d873bf`
- deployed SHA: `150025b9662404e5f98cd397c74c5d8be386460c`
- Free plan; no payment, paid overage or custom domain recorded.

The current connector set exposes Cloudflare skills/documentation but no authenticated Cloudflare account API action. No Cloudflare setting was changed by this ledger.

## Supabase

Project `ssdgfgqnjlwzkgukzeef`:

- status `ACTIVE_HEALTHY`;
- region `ap-south-1`;
- existing project preserved;
- migrations exactly:
  - `20260801130701 qelly_final_live_activation_v1`
  - `20260801131043 qelly_final_live_performance_indexes`
- Qelly public tables: `10`;
- RLS: `10/10`;
- public policies: `27`;
- Qelly triggers: `9`;
- `qelly_private` functions: `7`;
- Auth users: `0`;
- Auth sessions: `0`;
- all Qelly application and provider-cache row counts: `0`.

A valid enabled modern browser-safe publishable key exists. Its value is intentionally not recorded.

Advisor state is informational only:

- `qelly_provider_cache` has RLS and intentionally no public policies;
- five indexes are unused while the project has no retained traffic/data.

No schema, migration, policy, trigger, function or RLS change was performed.

## Auth URL gate

Current live evidence still shows Supabase Auth requests and historical confirmation verification associated with `http://localhost:3000`. The previous controlled flow proved registration, confirmation-email delivery, verification and implicit session issuance, but did not reach the production callback.

Required hosted configuration:

- Site URL: `https://qelly-intelligence.pages.dev`
- exact redirect: `https://qelly-intelligence.pages.dev/auth/callback.html`
- exact recovery redirect: `https://qelly-intelligence.pages.dev/auth/callback.html?flow=recovery`
- no broad production wildcard.

The connected Supabase tool exposes project/database/log/key/advisor operations but no hosted Auth URL-configuration write operation. `SUPABASE_AUTH_URL_CONFIGURATION_REQUIRED` therefore remains the only immediate account-side gate.

## Gmail and Vercel

Gmail notifications reconcile the canonical gate, release external verifier, Cloudflare integration and controlled Auth forensic runs.

Vercel account/team inspection returned zero projects. State: `VERCEL_NOT_USED`. No Vercel project or deployment was created.

## Preserved evidence

- immutable predeployment PDF: `QELLY_COMPLETE_FRONTEND_ALL_SCREENS_MASTER.pdf`
- pages: `436`
- SHA-256: `9f47138a1d43237dca01bef907aa48b158405d1d00e86953bfb9e9f28bbbf0b6`
- the public-runtime master PDF remains gated on successful production Auth, sync and deployed isolation.

## Exact next dependency

Use the hosted Supabase Dashboard URL Configuration page to replace localhost with the exact production Site URL and add the two exact callback URLs. After confirmation, rerun the prepared disposable two-user live Auth, synchronization and tenant-isolation matrix, clean all synthetic data, then continue public quality/UI evidence and PDF generation.

No secret is stored in this ledger.