# Qelly Release Matrix

| Gate | Required state | Current state | Result |
|---|---|---|---|
| Repository identity | `hemangsah/qelly-intelligence` | Verified | Pass |
| Starting main | `239f6f0c7c663801662f4e5f940ca76fb6941bf1` | Verified | Pass |
| PR open/draft/unmerged | Yes | Verified | Pass |
| Head branch | `feature/logo-first-brand-system` | Verified | Pass |
| Exact approved head | `75e39537e0ca6ba5eaf8fb688d0248fa63bd5614` | `6fabb1ac65d73cde25d1dca6d63a6685ef7d7e9a` | **Block** |
| Required workflows | Success on exact approved head | Success | Pass |
| Approved artifact | Exact expected identities | Verified | Pass |
| Unresolved review blockers | None | None | Pass |
| Guarded merge | Allowed only after all gates | Not attempted | Blocked |
| Post-merge main verification | Required after merge | Not started | Deferred |
| Brand tag | Required after verification | Not created | Deferred |
| Public-beta bootstrap | Required after verification | Not created | Deferred |
