# ADR 0002 - PostgreSQL production target with SQLite development adapter

**Decision:** Use a repository boundary. PostgreSQL is required in production; SQLite is allowed only in development/test unless an explicit unsafe override is set.

**Consequence:** Local tests remain dependency-free while deployment must validate PostgreSQL migrations, least-privilege roles and RLS.
