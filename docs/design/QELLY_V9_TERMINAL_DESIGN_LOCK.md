# Qelly V9 Terminal Design Lock

Status: implementation acceptance baseline
Date: 2026-08-18
Canonical runtime target: https://qelly-intelligence.pages.dev/
Public mirror target: https://hemangsah.github.io/qelly-intelligence/

## Product contract

Qelly is a provenance-first, read-only market intelligence and quantitative research terminal. Visual polish never overrides source truth.

Non-negotiable rules:

1. No fabricated market values or simulated fallback in connected production runtime.
2. An upstream failure remains `STALE`, `UNAVAILABLE` or `ERROR`; it is never converted into a synthetic live value.
3. Provider technical reachability and commercial/redistribution rights are separate states.
4. Unsupported execution, custody, MFA, passkeys or remote-session functionality may not be rendered as interactive mock controls.
5. Cloudflare is the canonical runtime. GitHub Pages is a public mirror of the same product behavior and uses the canonical API where required.
6. A release is not accepted until exact-head CI, source contract, deployment identity and browser evidence converge.

## Data and provider hierarchy

### Public live observations

- Hyperliquid - fast public market observations.
- Alternative.me - public ticker/sentiment reference observations.

These values remain externally sourced and attributed. They are research inputs, not executable prices.

### Governed reference data

- ECB - foreign-exchange reference rates with observation and ingestion timestamps.
- World Bank - macroeconomic reference observations.

Reference data is allowed to be delayed when the cadence is inherently delayed. It must be labeled accordingly.

### External research/display boundary

- TradingView
- Forex Factory
- DefiLlama
- CoinGlass
- Hypurrscan
- CoinMarketCap / other approved reference links

These are human-facing research destinations or display widgets. External observations are not silently ingested into Qelly analytics. If a provider blocks embedding, the product renders a clean external-link fallback.

### Rights-blocked providers

- Binance
- Coinbase

Until commercial and redistribution rights are verified in the provider registry, these providers remain unavailable as internally redistributed live feeds. Do not convert `rights blocked` into `technical outage`, and do not substitute fabricated values.

## Global shell

- Dark institutional canvas with restrained Qelly magenta accent.
- Route title: 26-34px desktop, 22-28px tablet/mobile.
- Readable body text: 13-16px depending on density.
- Evidence labels remain compact, but primary data must not use 8-10px body typography.
- Use fewer competing borders; panel hierarchy is created through surface elevation, spacing and type scale.
- Global search and route navigation remain compact and persistent on customer routes.
- Access routes hide irrelevant shell controls and prioritize account trust.

## Live Markets

Primary order:

1. Route title + concise truth boundary.
2. Fast public observations and source health.
3. Market visualization / usable source rows.
4. Provenance: source, observed at, fetched at, attribution, state.
5. Provider governance matrix.
6. External research dock.

The first viewport must not be dominated by Binance/Coinbase rights warnings. Rights-blocked providers belong in the governance matrix.

Truth badges:

- LIVE - fresh public observation.
- REFERENCE - governed delayed/reference observation.
- STALE - last valid observation retained inside governed stale window.
- RIGHTS BLOCKED - redistribution permission not established.
- UNAVAILABLE - no valid observation.
- ERROR - runtime/provider failure.

## Authentication

Authentication is a focused two-surface experience on desktop and a single column on mobile.

Left/proof surface:

- Private - secure browser session.
- Scoped - workspace-only persistence.
- Read-only - no trading or custody.

Right/action surface:

- Sign-in form with clear labels, readable controls, password visibility toggle, structured error state.
- Registration and recovery are shown only when the runtime proves transactional email capability.
- Passkeys/MFA are not shown as functional actions until implemented and verified.

## Account, Profile and Session

Primary hierarchy:

1. Identity and verification summary.
2. Profile preferences and save action.
3. Current-session assurance.
4. Security capability boundary.
5. Technical identifiers under disclosure.

Workspace ID, user ID, raw session identifiers, policy versions and release metadata are technical evidence, not primary profile content.

## Formula, Calculator and Indicator surfaces

Decision-useful methodology and outputs are primary. Documentation remains available without dominating the first viewport.

- Methodology headline.
- Deterministic/local badge when applicable.
- Inputs and assumptions.
- Worked output / result KPIs.
- Formula version, units, technical reference and long tables below or under disclosure.
- No live-market wording on formulas that only use user inputs.

## Security and backend presentation

The UI derives capability state from runtime evidence.

Required remediation queue:

1. Review `qelly_market_data_snapshot` and `qelly_timeseries_history` SECURITY DEFINER grants. Retain only the minimum privilege required by the actual API path.
2. Enable leaked-password protection in Supabase Auth through the project setting when supported by the connected management surface.
3. Move `pg_net` out of the public schema only after migration/dependency compatibility is proven.
4. Keep RLS enabled for user/workspace-owned tables.

## Responsive contract

Desktop:
- Two-column analytical surfaces only when both columns remain readable.

Tablet:
- Evidence/provider panels stack below the primary work surface.

Mobile:
- No horizontal page scroll.
- Tables use contained horizontal scrolling.
- Buttons/inputs maintain practical touch targets.
- Priority order: identity/decision surface -> primary action -> supporting evidence -> technical disclosure.

## Release acceptance

A release is accepted only when all of these are true on the same exact release SHA:

- Repository tests pass.
- V8 live-terminal semantic contract passes.
- Cloudflare parity checks pass.
- GitHub Pages mirror checks pass.
- Connected runtime does not expose `simulated` as a production market state.
- Fabricated market fallback is false.
- At least one approved fast public market source is available.
- ECB governed reference data is available or explicitly preserved as stale inside the stale window.
- Auth/profile capability labels match runtime truth.
- Browser evidence contains no unhandled page/console errors on required routes.
- All-screens desktop/mobile evidence shows no legacy visual regression.
- No Vercel parity claim is made until a Qelly Vercel project exists.
