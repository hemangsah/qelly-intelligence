# Qelly Sync Wave 2 — Isolated Supabase Acceptance

Date: 2026-08-05 (Asia/Kolkata)

## Scope and safety boundary

This evidence covers draft PR #35 on branch `agent/qelly-sync-wave-2`.

- production Supabase project `ssdgfgqnjlwzkgukzeef` was not changed
- `main` was not changed
- no pull request was merged or marked ready
- no SMTP attempt was made
- no Cloudflare production setting, Gmail, Vercel, or automation state was changed

The tests ran in a temporary free Supabase project:

- project name: `qelly-sync-wave-2-acceptance`
- project reference: `fdwvqfnrqtnjzxiwtyvm`
- region: `ap-south-1`
- project cost reported by Supabase: `$0/month`
- final state: paused

## Clean-provisioning defect found and corrected

A replay of the inherited migration chain initially produced this PostgreSQL error at migration 111:

```text
cannot drop function qelly_workspace_role(uuid,uuid) because other objects depend on it
```

RLS policies created by migration 109 still depended on the public helper when migration 111 attempted to drop it. The failing migration was transactional and left no partial state.

PR #35 adds:

```text
packages/migrations/110a_qelly_private_workspace_role_policy_transition.sql
```

The migration sorts after 110 and before 111, creates `qelly_private.workspace_role`, rewrites dependent policies, and conditionally rewrites the temporary editor policies only while the public helper still exists. It is safe on both fresh and already-hardened installations.

A second clean replay from zero successfully applied this exact order:

1. `109_prompt2c_global_public_beta.sql`
2. `110_prompt2c_revision_trigger_order.sql`
3. `110a_qelly_private_workspace_role_policy_transition.sql`
4. `111_qelly_final_live_activation_hardening.sql`
5. `112_qelly_final_live_performance_indexes.sql`
6. `20260805013300_qelly_atomic_sync_batch_v1.sql`
7. `20260805013400_qelly_sync_operation_evidence_lockdown.sql`
8. `20260805013500_qelly_sync_batch_workspace_index.sql`
9. `20260805013600_qelly_sync_operation_policy_cleanup.sql`

Migration 111, which had failed before 110a existed, passed on the empty schema.

## Functional acceptance

### Create, replay and idempotency

- one-record create returned `applied: 1`, `conflicts: 0`, `replayed: false`
- retry with the same key and payload returned the same batch ID and `replayed: true`
- a different client diagnostic hash did not change the database-derived authoritative request hash
- replay left exactly one calculation revision and one operation-evidence row
- same key with a different payload was rejected with SQLSTATE `22023`
- reusing an operation ID for a different request was rejected
- rejected requests did not leave orphan batch-ledger rows

### Compare-and-swap and rollback

- stale base revision returned an explicit per-item conflict without mutation
- correct base revision advanced the record from revision 1 to revision 2
- replay did not create an extra revision
- a three-record request with an invalid middle record left zero calculations, revisions, operation rows and batch-ledger rows for the attempted batch

### Bounded capacity

Database execution observations in the isolated project:

- 1 record: successful
- 50 records: 50 applied, 0 conflicts, approximately 42.5 ms
- 100 records: 100 applied, 0 conflicts, approximately 64.3 ms
- 101 records: rejected before ledger or data writes

The Cloudflare API implementation makes one Supabase RPC request for each bounded batch.

### True concurrent requests

A disposable HTTP concurrency harness launched two independent PostgREST calls at the same time.

Identical key and payload:

- both requests returned HTTP 200
- both returned the same batch ID and result
- one response had `replayed: false`
- the other response had `replayed: true`
- exactly one calculation, revision, operation row and batch ledger were created

Same key with different payloads:

- one request committed successfully
- the competing request returned HTTP 400 / SQLSTATE `22023`
- exactly one winning record, operation row and ledger existed

The test-only wrapper and temporary `pg_net`/`dblink` extensions were removed before final inspection.

## RLS and role acceptance

Two disposable Auth identities exercised `auth.uid()` and RLS under the `authenticated` role.

- each user initially saw exactly one own profile and workspace
- user B saw zero of user A's workspaces, calculations or operation evidence
- user B could not invoke the RPC on user A's workspace
- viewer membership could not write
- editor membership could create an editor-owned record in the shared workspace
- the editor could not modify the workspace owner's calculation
- direct authenticated insertion into `qelly_sync_operations` was denied at the privilege layer

## Final catalog and privilege state

After the clean replay:

- `public.qelly_workspace_role(uuid,uuid)` absent
- `qelly_private.workspace_role(uuid,uuid)` present
- `public.qelly_sync_push_batch(uuid,text,text,jsonb)` present
- `qelly_sync_batches_workspace_idx` present
- only `qelly_sync_own_select` remains on the operation-evidence table
- `authenticated` can execute the RPC
- `anon` and `service_role` cannot execute the RPC
- authenticated clients have evidence-table `SELECT` but not `INSERT`
- the private batch ledger remains inaccessible to authenticated clients

## Advisor results

PR-specific advisor findings were corrected:

- missing `sync_batches.workspace_id` foreign-key index: resolved
- obsolete synchronization evidence write policies: removed
- synchronization SELECT policy uses `(select auth.uid())`

Remaining notices are outside the Sync Wave 2 change surface:

- intentional server-only `qelly_provider_cache` has RLS and no browser policies
- the authenticated RPC is intentionally `SECURITY DEFINER` and protected by explicit identity, workspace-role, ownership, opt-in, validation, hashing and grant checks
- disposable-project leaked-password protection remained disabled
- inherited profile, workspace-owner, feedback and account-deletion RLS policies still have `auth_rls_initplan` performance warnings
- unused-index notices are expected in a fresh, nearly empty acceptance database

## Cleanup proof

Before pausing the disposable project, verification returned zero for Auth users, identities, sessions, profiles, workspaces, memberships, calculations, revisions, synchronization operations, private batch-ledger rows, feedback, deletion requests, audit events and provider-cache rows.

## Repository validation

Validated implementation head before this evidence-only commit:

```text
c1d7d6e5b23ee7811d251b9cb59015398991addb
```

Validation on that implementation head:

- `npm ci`: passed; zero reported dependency vulnerabilities
- complete Node suite: 490 passed, 0 failed, 0 skipped, 0 cancelled
- frontend build: passed
- Cloudflare index hardening: passed; zero inline scripts
- Cloudflare Pages deployment: passed

## Decision

The atomic synchronization and migration chain completed isolated acceptance. PR #35 remains draft until stacked PR sequencing, review, production migration planning, rollback planning, monitoring and inherited non-sync backlog are handled through change control.
