# ADR 0004 - Persistent database jobs with Redis signaling

**Decision:** Store job truth in the database and use Redis to signal pending work in production. Use a database-only queue in development/test.

**Consequence:** Idempotency, retries and dead-letter state survive worker restarts.
