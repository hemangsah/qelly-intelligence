# ADR 0005 - Incremental migration from inherited local stores

**Decision:** Do not destructively rewrite all inherited JSON domain stores in one release. Migrate identity and jobs first, then move domain stores through explicit adapters and reconciliation.
