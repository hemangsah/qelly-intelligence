# Supabase production source

`supabase/` is the canonical production Supabase line: provider ingestion and release-identity Edge Functions plus the post-2026-08 migrations that govern provider data, schedules, identity, UI preferences and schema reconciliation.

The separate `infra/supabase/` subtree is intentionally retained. It contains the earlier Verify/workspace compatibility line (Verify sealing, workspace CRUD/search/export/restore and its 2026-08-08 migrations). The two trees have distinct deployment provenance and are referenced by separate contract tests; merging them would risk migration ordering and deployed-function identity. New production schema/function work belongs here. Compatibility-line changes belong under `infra/supabase/` until a reviewed migration/function convergence plan exists.
