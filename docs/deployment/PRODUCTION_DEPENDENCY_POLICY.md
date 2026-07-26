# Production Dependency Policy

Qelly production starts only with PostgreSQL, Redis, private S3-compatible storage, ClamAV, external email, signed webhooks, and configured encryption keys. `/api/ready` reports non-ready when any required dependency or security boundary is unavailable.

Development and test modes may use SQLite, local atomic stores, a database queue, local object storage, deterministic malware signatures, and local delivery sinks. These modes must remain visibly labelled and cannot be silently selected in production.
