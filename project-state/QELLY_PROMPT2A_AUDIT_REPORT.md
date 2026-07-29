# Qelly Prompt 2A — World-Scale Repository Gap Audit and Implementation Blueprint

Generated: 2026-07-29T15:49:53+05:30
Repository: `hemangsah/qelly-intelligence`
Verified starting main: `26d2c9c453992b74dd3931d6b8b9489117d0b44c`
Audited exact source head: `eafb11719e67135c7a6fa3b15e1170c5192e4771`
Audit branch: `feature/prompt2-repository-gap-audit`
Draft PR: `#19`
Final audit head: `bedebf9478752126ffe9348b48a6e9ff8044637f`

## Executive verdict

Qelly is a polished static/read-only visual preview with substantial local/test architecture, governance, persistence, identity, queue, evidence and design foundations. It is **not** a complete connected financial intelligence product. No runtime route is classified `WORKING_CONNECTED`; no external market-data, broker, exchange, wallet, bank, news or observability provider has production-connected evidence. Prompt 2A performed audit/registry work only.

The most urgent truth defects are public/prototype wording that says “connected” or “live” and deterministic market values that can appear current. These findings must be fixed in a separate focused draft hotfix because Prompt 2A is an audit PR.

## Live starting state

- Authenticated owner/admin verification through the connected GitHub app: `hemangsah`.
- Exact main remained `26d2c9c453992b74dd3931d6b8b9489117d0b44c` before audit mutation.
- Immutable tags resolve to `239f6f0c7c663801662f4e5f940ca76fb6941bf1` and `94fbd4ff91c0d61f87e42724038f03fa5c36f97a`.
- Prompt 1 PRs #13, #14 and #18 are merged; #15, #16 and #17 are closed unmerged.
- Six Dependabot PRs (#1–#6) were open at exact-head evidence capture; initial connector search omitted them, and this audit corrects that record.
- Pages deployment `5654431325` points to `26d2c9c453992b74dd3931d6b8b9489117d0b44c` and remains a static preview.
- No GitHub release exists. The branch-protection endpoint returned 403 to the Actions token; no rulesets were visible.

## Repository reality

- Repository files: 721 exact inventory records; bootstrap counted 721 files, 711 text and 10 binary.
- Runtime routes/screens: 61.
- Route classes: {'STATIC_DEMO': 8, 'PARTIAL': 53}.
- Canonical design-component contracts: 40 (`PARTIAL`/`CONTRACT_ONLY`, not 40 completed components).
- Frontend controls/actions statically inventoried: 433; classifications: {'DEAD_OR_DECORATIVE': 68, 'HANDLER_BOUND': 360, 'FORM_SUBMIT': 3, 'GLOBAL_HANDLER_OR_UNPROVEN': 2}.
- Backend service modules: 73; classifications: {'PARTIAL': 52, 'MOCK_ONLY': 4, 'UNTESTED': 13, 'PROVIDER_BLOCKED': 3, 'CONTRACT_ONLY': 1}.
- Internal API contracts: 187.
- Database tables created by migrations: 28.
- Worker/stream/workflow records: 22.
- Providers/candidates/fixtures: 28.
- External hostname tokens: 33 (many are local/test/invalid or parser false positives, not production providers).
- Embeds/external render libraries: 1.
- Redirect/reference records: 2.
- Feature flags: 9.

## Feature reality

Canonical feature-universe status counts: `{'IMPLEMENTED_DETERMINISTIC_LOCAL': 37, 'PLANNED': 343, 'DEFERRED': 5, 'IMPLEMENTED_CONNECTED': 1, 'PROTOTYPE': 63, 'PARTIAL': 96}`. Existing stable IDs are preserved. A route, API, schema, mock, fixture, screenshot or registry row never raises a feature to connected status.

## Requested features

| Feature | Exact Wave 0 status | Target wave |
|---|---|---|
| EA marketplace | `PLANNED` | `WAVE_6` |
| Indicators | `PROTOTYPE` | `WAVE_1` |
| Quant Calculator Center | `PLANNED` | `WAVE_1` |
| SIP/India Finance Center | `PLANNED` | `WAVE_1` |
| Account-opening directory | `PLANNED` | `WAVE_2` |
| Wallet connections | `REQUIRES_AUTHORIZATION` | `WAVE_4` |
| Broker connections | `REQUIRES_AUTHORIZATION` | `WAVE_4` |
| Exchange connections | `REQUIRES_AUTHORIZATION` | `WAVE_4` |
| Strategy builder | `PLANNED` | `WAVE_5` |
| Backtesting | `PLANNED` | `WAVE_5` |
| Paper trader | `PLANNED` | `WAVE_3` |
| Observed liquidations | `PLANNED` | `WAVE_3` |
| Estimated liquidation heatmap | `PLANNED` | `WAVE_7` |
| Whale detector | `PLANNED` | `WAVE_7` |
| Order-flow workstation | `PLANNED` | `WAVE_7` |
| Options intelligence | `PLANNED` | `WAVE_7` |
| On-chain intelligence | `PLANNED` | `WAVE_7` |
| News | `PROTOTYPE` | `WAVE_2` |
| Community | `PLANNED` | `WAVE_2` |
| AI Copilot | `PLANNED` | `WAVE_8` |
| Governed agents | `PLANNED` | `WAVE_8` |

## API/provider verdict

- Actual source integrations exist only for conditional public Binance/CoinDCX reads and deterministic Qelly fixtures; connected-provider feature flag remains disabled.
- Official candidate APIs and user-authorized providers are catalogued, but production eligibility is blocked until legal, attribution, caching, redistribution, commercial-use, geography, schema and operational conformance are complete.
- Yahoo Finance/unofficial endpoint audit found **no runtime Yahoo dependency**; the only match is the Prompt 2A scanner pattern itself.
- SEC EDGAR, World Bank, Frankfurter and OpenFIGI v3 are viable official/public candidates for their limited purposes, subject to source-specific policy and data-rights controls.
- Broker/wallet/exchange connections are authorization-gated and not implemented.

## Architecture gaps and risks

See `QELLY_SECURITY_RISK_REGISTER.csv` and `QELLY_RELEASE_BLOCKERS.md`. Major gaps include truthful provider-failure behavior, per-endpoint auth/tenant proof, canonical entity migration, provider legal/conformance, secure token vault, domain persistence/jobs, route-specific browser/accessibility/performance evidence, and licensed production data.

## Implementation program

Use `QELLY_IMPLEMENTATION_WAVES.md` and `QELLY_DEPENDENCY_GRAPH.json`. The first permitted implementation wave is Wave 1 on `feature/calculator-and-indicator-foundation`, but it must not begin automatically.

## Validation

All exact-head repository gates and CodeQL passed. The generated registries are validated for unique IDs, canonical statuses, CSV/JSON parseability and checksum integrity by the Prompt 2A audit validator. No test was weakened.

## Scope statement

Prompt 2A did not implement calculators, indicators, providers, paper trading, connections, strategy builder, marketplace, order flow, options, on-chain, community or AI. Main was not modified, the audit PR remains draft, and no audit branch deployment is authorized.
