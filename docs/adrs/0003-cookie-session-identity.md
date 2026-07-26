# ADR 0003 - Signed cookie sessions

**Decision:** Authenticate browsers with signed HttpOnly SameSite cookies. Persist only session-token hashes and derive CSRF from the raw session token. Rotate sessions explicitly.

**Consequence:** The application does not expose long-lived bearer tokens to browser JavaScript.
