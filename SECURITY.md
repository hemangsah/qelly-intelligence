# Security Policy - Release A1

Do not report or paste passwords, access tokens, private keys, seed phrases or recovery phrases into public issues or chat.

Release A1 implements signed HttpOnly cookie sessions, session rotation, session-derived CSRF, scrypt password hashing, tenant context and tamper-evident audit integration. It does not constitute an independent penetration test or compliance certification.

Production deployment must provide PostgreSQL, Redis, TLS, strong secrets, least-privilege database roles, backup/restore, monitoring and security scanning. SQLite and the database queue are development/test adapters.

Live trading, custody, transfers, withdrawals, private keys and recovery phrases are intentionally unsupported.
