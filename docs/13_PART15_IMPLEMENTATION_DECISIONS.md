# Part 15 Implementation Decisions

1. **Preserve, do not rewrite:** Part 12.7 and Part 14 foundations are reference baselines.
2. **Local before production:** demonstrate security and runtime boundaries using deterministic fixtures without pretending to authenticate users or consume licensed feeds.
3. **Deny by default:** authorization and entitlement engines require explicit allow conditions.
4. **Govern mutations:** high-assurance actions require step-up; non-repeatable changes require idempotency keys and audit evidence.
5. **Keep symbols mutable:** canonical QI IDs are identity; symbols are validity-bounded aliases.
6. **No silent fallbacks:** provider fallback is surfaced in runtime metadata; stale data is relabeled.
7. **No secrets in browser or artifacts:** only opaque credential references are modeled.
8. **Production gates stay visible:** distributed infrastructure, real identity, licensed rights and live financial actions remain disabled.
