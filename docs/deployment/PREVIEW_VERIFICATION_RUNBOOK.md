# Externally Hosted Preview Verification

Do not report a preview URL until every check below passes against externally reachable HTTPS endpoints.

## Before traffic

1. Run `NODE_ENV=production npm run env:check` inside the secret-injected operations job.
2. Run `npm run migrate`, then run it again.
3. Run `npm run migrate -- --status`; the latest migration must be `106_deployment_runtime_state.sql` and pending must be empty.
4. Start the worker and run `node scripts/worker-health-check.mjs`.
5. Start the API. Strict startup must succeed without an override.
6. Require HTTP 200 from `/api/health` and `/api/ready`.

## API and persistence

- Register a new preview-only account.
- Restart the API and verify login and session persistence.
- Verify organization and workspace scope.
- Create and reload a watchlist and alert.
- Verify the PostgreSQL portfolio record and portfolio APIs.
- Create a Decision Provenance graph, traverse upstream and downstream, verify integrity, and export evidence.
- Verify a second tenant and second workspace cannot read those records.
- Exercise concurrent mutations and an intentional transaction rollback.

## Queue and worker

- Enqueue one idempotent job twice and observe one database job.
- Exercise delayed dispatch, exponential retry, terminal dead letter, worker restart recovery, and graceful termination.
- Require Redis TLS and a current worker heartbeat in readiness.

## Storage and scanner

- Confirm authenticated bucket access and anonymous list denial in `/api/ready`.
- Confirm the provider's public-access block is enabled and object/bucket public ACLs are disabled.
- Upload the same filename and hash into two tenant/workspace scopes and verify the generated keys and authorized reads remain isolated.
- Upload clean content through `quarantine/` and verify release into `released/`.
- Interrupt an upload before its S3 PUT completes and verify no released object exists.
- Upload identical content twice in one scope and verify the deterministic released key handles the duplicate hash without cross-tenant deduplication.
- Verify a short-lived signed download and authorized deletion.
- Reject EICAR.
- Stop or block ClamAV and verify release and readiness fail closed.
- Confirm TCP 3310 is not publicly reachable.

## Delivery

- Send registration, recovery, and operational messages.
- Verify persistent delivery attempts, retries, and failure records.
- Verify the email sender/domain and authenticated health endpoint.
- Verify exact webhook body signing, timestamp, delivery ID, HMAC-SHA256, stale rejection, bad-signature rejection, duplicate rejection, HTTPS allowlist enforcement, and private-network rejection.

## Frontend and accessibility

- Load the exact TLS frontend URL on desktop and mobile widths.
- Verify authentication, public market overview, rankings, asset detail, candles, watchlists, portfolio, Decision Provenance, explain-move, export, degradation states, and visible errors.
- Verify keyboard navigation, focus order, reduced motion, and no browser console credential or CORS errors.
- Confirm API, worker, database, Redis, storage, scanner, and delivery logs contain correlation IDs and no secrets.

Record the commit SHA, image digests, migration output, health JSON, test account IDs, URLs, and timestamps. Do not record credentials.
