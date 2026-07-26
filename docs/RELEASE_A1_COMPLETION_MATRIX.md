# Release A1 Completion Matrix

| Area | Status | Notes |
|---|---|---|
| Registration/login/logout/rotation | Implemented locally | Full API and frontend flow tested with SQLite adapter |
| Secure cookies and CSRF | Implemented locally | Secure cookie flag activates in production mode |
| User/org/workspace persistence | Implemented locally | SQLite exercised; PostgreSQL repository packaged |
| PostgreSQL integration | Partial contract | Live service integration not executed here |
| Redis job signaling | Partial contract | Adapter packaged; live Redis not executed here |
| Persistent worker and in-app notifications | Implemented locally | Replay-safe tests pass |
| Passkeys/MFA/recovery | Partial contract | Not implemented |
| External notification delivery | Missing | In-app only |
| Cloud deployment | Blocked by credentials | No deployment target connected |
| Financial execution/custody | Disabled for safety | No endpoints |
