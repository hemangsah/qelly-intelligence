# Release acceptance metadata retention

Hourly release synchronization replaces the metadata object on an existing release
row. That erases separately recorded tested-head, Browser run and production
acceptance fields, even though the source revision remains correct.

A before-update trigger merges existing metadata with incoming metadata atomically
for the same environment, release key and source revision. Incoming values win,
including false and JSON null, so operators can explicitly invalidate prior
acceptance. A changed identity never inherits another identity's evidence. No
acceptance fields or successful test claims are synthesized.

The function uses invoker privileges, a catalog-only search path and no public
execute grant. Existing table permissions and RLS govern writes. No scheduler,
credential, table policy or Edge Function change is needed.

The PostgreSQL foundation gate executes the exact migration against a temporary
table inside a rolled-back transaction. It covers repeated upserts, replacement
of runtime values, explicit acceptance invalidation and release isolation.
Production acceptance also requires deployed migration and an actual scheduler
sync retaining the existing verified fields.
