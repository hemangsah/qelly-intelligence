# Rollback Runbook

1. Stop new deployments and disable traffic shifting.
2. Confirm database, queue, object storage, and provider health.
3. Preserve logs, request IDs, failed-job records, and audit heads.
4. Route traffic to the last verified application image.
5. Do not reverse a database migration until its rollback safety has been reviewed.
6. Prefer a forward migration when reverting would discard or reinterpret data.
7. Replay only idempotent jobs; inspect dead-letter records before replay.
8. Run `/api/health`, `/api/ready`, authentication, market overview, asset detail, watchlist, portfolio, and Decision Provenance smoke checks.
9. Record the incident, rollback commit, database version, and recovery evidence.
