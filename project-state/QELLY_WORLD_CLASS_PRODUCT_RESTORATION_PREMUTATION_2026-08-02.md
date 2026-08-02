# Qelly World-Class Product Restoration — Pre-Mutation Ledger

Timestamp: 2026-08-02T04:55:00Z

## Read gate

`QELLY_ULTIMATE_WORLD_CLASS_PUBLIC_PRODUCT_RESTORATION_MASTER.txt` was read completely three times before this branch or ledger was created. Each pass contained 1,916 lines and matched SHA-256 `4a7570a96758354269653d108c6fb879cd5ac68dbb4fa4168955705593283206`.

## Governed topology

- Repository: `hemangsah/qelly-intelligence`
- `main`: `9cb98780893924ad26fbf4baaa9048e80a162b2c`
- PR #23: open, draft, unmerged at `17eeadac4c510cc3c312185e86b0ac5907f3789b`
- PR #25: open, draft, unmerged at `150025b9662404e5f98cd397c74c5d8be386460c`
- Prompt 2C feature: exact `150025b9662404e5f98cd397c74c5d8be386460c`
- Release branch: exact `150025b9662404e5f98cd397c74c5d8be386460c`
- Current immutable checkpoint: exact `150025b9662404e5f98cd397c74c5d8be386460c`
- Deterministic fallback: `603cece3091dc59cfb72680914e7056b40058022`
- Corrective branch: `feature/prompt2c-production-ui-defect-sweep`, created from exact `150025b...`
- No governed ref, checkpoint, PR readiness state or `main` was changed.

## Deployment and backend

- Cloudflare Pages project: `qelly-intelligence`
- Public URL: `https://qelly-intelligence.pages.dev`
- Recorded production deployment: `cd20f2a9-1ff6-46b4-ae23-bc4df9d873bf`
- Supabase project: `ssdgfgqnjlwzkgukzeef`, `ACTIVE_HEALTHY`, `ap-south-1`, Free
- Migrations: `20260801130701 qelly_final_live_activation_v1`, `20260801131043 qelly_final_live_performance_indexes`
- Tables: 10; RLS: 10/10; policies: 27; triggers: 9; `qelly_private` functions: 7
- Current rows: one Auth user/session/profile/workspace; no member, saved-calculation, revision, sync, provider-cache, feedback, deletion-request or audit rows.
- The remaining account is proven synthetic: display/profile metadata `Qelly URL Verification`, created during workflow run `30730126986`. It is not treated as a legitimate owner account.
- Security advisor: leaked-password protection disabled (warning); provider cache RLS/no direct policy (informational and potentially intentional server-only architecture).
- Vercel: one team, zero projects; `VERCEL_NOT_USED`.

## Workflow evidence after canonical gate

- Canonical accepted gate: run `30715389847`, job `91409986845`, artifact `8823173218`, SHA-256 `590b3118e3e1a9ff6f9b55d1ed1bdf475a3fbe9abfc9d65bf49a5f38066774bc`.
- Auth URL probe `30730042036`: confirmation succeeded, redirect was `http://localhost:3000/`.
- Auth URL probe `30730126986`: confirmation succeeded, redirect was `http://localhost:3000/`.
- Auth URL probe `30730133922`: stopped by email rate limit `429`.
- No further confirmation-email probe is authorized until the proven URL configuration/root cause is corrected.

## Source trace and proven root causes

1. `scripts/build-frontend.mjs` writes `productMode: QELLY GLOBAL PUBLIC BETA`, `dataMode: public-runtime` and a signed-out default route supplied by the API.
2. `apps/web/public/assets/prompt2c-public-beta.mjs` injects a global operations banner with deterministic/network/Auth/cloud-sync/release-SHA flags on every page.
3. `apps/web/public/index.html` exposes QA state/persona selectors and a technical shell as primary production chrome.
4. `functions/api/v1/[[path]].js` returns signed-out `defaultRoute: auth-login`, preventing the root route from becoming the market-intelligence entry experience.
5. `apps/web/public/assets/routes/auth-login.mjs` uses foundation/development/local-environment language and prioritizes organization creation over a standard account journey.
6. `apps/web/public/assets/routes/calculator-detail.mjs` makes raw JSON the default input surface and exposes formula/engine internals in the primary result summary.
7. Generic route error handling in `apps/web/public/assets/app.js` maps authentication-required responses to `Unable to render this route`, conflating access state with runtime failure.
8. Existing public provider endpoints already expose Coinbase, ECB and truthful Binance availability, but the signed-out homepage does not surface them.
9. Hosted Supabase Auth verification still redirects to localhost. Evidence does not prove a source-level trailing bracket; the two successful workflow logs show `http://localhost:3000/`. Dashboard Site URL/template/environment construction must still be reconciled without consuming email quota.

## Mutation boundaries

- Preserve formula and indicator numerical engines.
- Preserve RLS and accepted migrations.
- No LinkedIn/social-media work.
- No Vercel project or deployment.
- No trading, custody, transfer, signing or execution features.
- Product changes must be functional, tested, responsive and production-guarded—not cosmetic string replacement.
