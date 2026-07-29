# Qelly Known Limitations — Prompt 2A Wave 0

Generated: 2026-07-29T15:49:53+05:30
Audited source head: `eafb11719e67135c7a6fa3b15e1170c5192e4771`

- GitHub Pages is a public static/read-only visual preview, not a connected full production product.
- Runtime route count is 61; `WORKING_CONNECTED` count is 0. 8 routes are classified `STATIC_DEMO`; 53 are `PARTIAL`.
- The repository exposes 187 internal API contracts, but contract presence/HTTP 200 does not prove production connectivity, authorization, persistence, tenancy or provider correctness.
- The default/live-preview truth is compromised by misleading connected/live wording and realistic deterministic fixtures; a separate hotfix is required.
- The public-provider adapters are disabled by default for governed public beta and have incomplete license/redistribution/geographic review.
- No calculator center, India finance center, governed indicator library, paper trader, strategy builder, backtester, marketplace, read-only account connections, liquidation/order-flow/options/on-chain stack, community, Copilot or governed-agent runtime is complete.
- Formula and rule records created in this audit are specifications only, not executable product features.
- Branch protection could not be read through the Actions integration (HTTP 403); do not infer absence or presence.
- Six pre-existing Dependabot PRs were open at evidence capture; an earlier connector search omitted them. No audit mutation touched those branches.
- Real-money trading, custody, deposits/withdrawals, private-key/seed handling and autonomous execution remain deliberately disabled.
