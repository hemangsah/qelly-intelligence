# Qelly Prompt 2A Release Blockers

Generated: 2026-07-29T15:49:53+05:30
Source head: `eafb11719e67135c7a6fa3b15e1170c5192e4771`

1. **Truth-label hotfix required.** Public/prototype screens use “connected” and “live” wording without production-connected evidence; hard-coded market tape values can appear current.
2. **Silent live-to-fixture behavior must be removed for production paths.** Provider failure must become `UNAVAILABLE`/`STALE` unless the user deliberately selected `DEMO`.
3. **No provider has completed legal, attribution, caching, redistribution, commercial-use and geographic review for connected production use.**
4. **Branch-protection enforcement was not verifiable through the read-only Actions token.** The endpoint returned HTTP 403; no rulesets were visible.
5. **Per-endpoint authorization and tenant-isolation proof is incomplete across 187 internal API contracts.**
6. **Production authentication, persistence, Redis, delivery, provider, observability and browser evidence are not proven on the public GitHub Pages deployment.**
7. **TradingView Lightweight Charts runtime CDN is unpinned and lacks SRI/self-hosting proof.**
8. **Wave 1 formulas need authoritative references, decimal conventions, effective dates and reference vectors before implementation.**

These blockers do not authorize Prompt 2B to start automatically. The next prompt must be invoked explicitly after review.
