# Release A1 - Production Platform Foundation

Release A1 converts Qelly's local identity concept into a runnable database-backed authentication and job-processing foundation while preserving the Part 22 sovereign experience.

## User-visible changes
- Secure login and registration.
- Organization and workspace creation during registration.
- Cookie-authenticated account/session page.
- Anonymous users are routed to secure access screens.

## Platform changes
- PostgreSQL schema and repository implementation.
- SQLite development/test adapter.
- Redis-signaled persistent jobs and worker process.
- In-app notification worker.
- Health/readiness, migration, seed and Docker Compose tooling.

## Important boundary
No external production deployment was performed. PostgreSQL and Redis require deployment integration verification. Financial execution and custody remain disabled.
