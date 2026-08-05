# Qelly Prompt 2C Incident and Rollback Runbook

## Severity

- **SEV-1:** cross-user exposure, secret exposure, destructive data loss, false financial/live-data claim, compromised authentication or unexpected billing risk.
- **SEV-2:** authentication unavailable, cloud sync corruption risk, provider-wide failure, critical-route outage or inaccessible essential journey.
- **SEV-3:** degraded provider, delayed synchronization, noncritical route defect or quota warning.

## Immediate containment

1. Freeze the exact failing deployment and preserve logs/artifact identities.
2. Disable provider or protected-write feature flags before disabling deterministic read-only tools.
3. For suspected data isolation or secret exposure, fail closed, revoke affected credentials through the official service dashboard and stop all cloud writes.
4. Display a truthful status message; never claim live data or cloud synchronization while disabled.
5. Keep GitHub Pages deterministic fallback reachable whenever safe.

## Application rollback

1. Identify the last accepted deployment ID and exact commit.
2. Re-run the release manifest checksum comparison.
3. Deploy the last accepted static artifact or release branch without rebuilding from an unverified dependency state.
4. Verify HTTPS, canonical URL, critical routes, headers and deterministic calculation parity.
5. Record rollback time, operator, source head, deployment ID and reason.

## Database rollback

1. Suspend nonessential and user writes.
2. Export user-owned data and verify export checksums.
3. Rehearse rollback against a disposable database before touching the active project.
4. Apply `packages/migrations/110_prompt2c_global_public_beta.down.sql` only when the product is returning to local-only mode and the data-retention decision is explicit.
5. Never drop public-beta tables during a transient provider outage.
6. Verify no orphaned auth users, storage objects or secrets remain.

## Provider incident

Set the affected provider to unavailable, use bounded cache only inside its stale window, expose the fallback reason and preserve deterministic demonstration/local results. Do not substitute an unapproved scraped source.

## Auth incident

Disable cloud actions, invalidate sessions through the official auth dashboard, preserve anonymous deterministic access, verify redirect allowlists and review audit events without logging credentials or financial payloads.

## Postmortem minimum

Timeline, exact heads, deployment IDs, affected journeys, data classes, root cause, containment, rollback proof, user communication, permanent corrective action, test added and owner.
