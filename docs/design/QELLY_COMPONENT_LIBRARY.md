# Qelly Intelligence — Component Library Contract

This library is the component-level implementation authority for the Qelly institutional terminal. Components are compositional contracts; route implementations may specialize content, but may not invent contradictory state semantics or a parallel shell.

## Shell components

### `SystemStrip`
Purpose: immutable top-level operational context.
Required fields: environment, release SHA/build identity, global data-health summary, session/auth state, UTC/local clock.
Rules: data health comes from runtime evidence; never infer from successful page render alone.

### `CommandBar`
Purpose: universal search and command entry.
Includes: command/search input, current context/instrument chip, keyboard shortcut affordance, notifications, profile trigger.
States: default, focused, searching, no-results, degraded-search.

### `NavRail`
Purpose: semantic route-family navigation.
Families: Markets, Discovery, Quant, Research, Portfolio, Operations, Evidence, Account.
Desktop: collapsed/expanded.
Mobile: replaced by five-item `BottomNav` plus More/command route access.

### `ContextBar`
Purpose: route-local context.
Includes: breadcrumb/title, relevant selectors, freshness state, local actions.
Never duplicate global command actions.

### `WorkspaceGrid`
Variants:
- `analysis-3pane`: context | primary | inspector
- `analysis-2pane`: primary | inspector
- `research`: sources/hypothesis | primary | inspector
- `operations`: status/table | inspector
- `focused`: single primary pane with optional Inspector sheet

Desktop grid must not force a fake reference surface above functional content.

### `Inspector`
Required when a route displays externally sourced, transformed, imported or calculated evidence.
Sections: Truth, Sources, Confidence, Coverage, Method, Assumptions, Contradictions, Permissions, Audit.
Can be docked, collapsed, or mobile sheet; its information must remain reachable.

### `ActivityTray`
Purpose: route/runtime activity and evidence events.
Examples: refresh completed, provider degraded, import validated, notification delivery attempt, canary result.
No trade/order execution vocabulary.

## Data and evidence components

### `TruthBadge`
Props: state, label, timestamp, reason.
Allowed states: fresh, stale, partial, missing, conflicting, degraded, simulated, unavailable, audit.
Must render icon/text in addition to color.

### `ProviderBadge`
Props: providerName, providerMode, health, entitlement, transport.
Provider modes: live-public, licensed-live, delayed, reference, cached, demonstration, unavailable.
Never convert `demonstration` to `live` based on WebSocket availability alone.

### `FreshnessStamp`
Displays observation and retrieval timestamps plus freshness SLA where relevant.

### `EvidenceList`
Dense key/value list for source, confidence, coverage, method, audit id and fallback reason.

### `SourceLink`
Official canonical provider/research source link.
Must open external origin safely and identify third-party navigation.

### `DataTable`
Institutional compact table with sticky identifier, sorting/filtering, keyboard focus, loading/empty/error states, column-priority responsive behavior and explicit unit/time context.

### `TimeSeriesChart`
Chart frame around the chosen chart engine. Required adjuncts: symbol/context, timeframe, source, timestamp, truth state, loading/no-data/error state. Chart library branding/attribution must comply with provider terms.

### `KpiCell`
Compact analytical value, label, unit and optional delta. Avoid consumer-dashboard giant-number tiles. Delta must distinguish direction from confidence/truth.

### `CoverageMeter`
Shows percentage/count and basis, not just a progress bar.

### `ConfidenceIndicator`
Shows confidence value/category and method. Initial unknown state = `Not supplied`, not a fabricated estimate.

## Input and calculation components

### `ParameterField`
Label, unit, value, validation, optional provenance if prefilled from market data.

### `FormulaBlock`
Definition, symbolic formula, variable definitions, assumptions and version.

### `ResultBlock`
Result, unit, precision, timestamp if dependent on external data, reproducibility id.

### `SavedCalculationRow`
Name, formula/tool, input snapshot, result snapshot, modified time, evidence availability.

### `IndicatorDefinition`
Definition, parameter set, input series/timeframe, warm-up requirement, output meaning and caveats.

## Auth/account components

### `AuthFrame`
Same visual product identity as terminal. Contains environment/release marker and focused auth card.

### `CredentialForm`
Accessible labels, reveal-password control, explicit submit/loading state and deterministic errors.

### `AuthError`
Error taxonomy: invalid credentials, unconfirmed email, expired/reused link, rate limited, network degraded, session expired, provider unavailable.
Never expose internal stack traces.

### `ProfilePanel`
Fields: identity, active workspace, memberships, security status, preferences, theme/persona, data preferences, session controls.

### `SecurityStatus`
MFA/passkey/recovery/password-protection state with human-readable remediation.

### `DangerZone`
Authenticated self-delete separated from sign-out and ordinary settings; clear irreversible-action treatment.

## Research/embed components

### `ResearchIntegrationCard`
Fields: provider, capability, official-mode (`embed`, `widget`, `deep-link`), description, terms/source link, current availability.
No arbitrary iframe URL input.

### `OfficialEmbedFrame`
Only for officially supported embeds/widgets. Enforces allowlisted origin, sandbox/referrer policy where compatible, loading/error fallback, accessible title, bounded responsive frame.

### `ExternalResearchLink`
For providers/sites without approved embedding. Shows provider identity, destination purpose and opens canonical link in a new context.

## Operational components

### `ApiHealthRow`
Endpoint/capability, owner, auth mode, provider, latency, last success, last error, truth state.

### `ProviderHealthRow`
Provider capability, legal/display mode, configured state, transport health, coverage, last observation, fallback.

### `ReadinessGate`
Evidence-derived gate only. No hard-coded stale claims. Each gate links to its supporting runtime evidence.

### `AuditEventRow`
Timestamp, actor/system, action, target, outcome, correlation/audit id.

## States every data component must implement

1. initial/loading
2. success/fresh
3. delayed/stale
4. partial
5. no coverage/missing
6. conflicting
7. degraded/fallback
8. demonstration/simulated
9. unavailable/disabled
10. permission/auth failure
11. network/timeout failure

A blank rectangle or silently retained old value is never an acceptable error state.

## Responsive behavior

At <= 960 px, secondary context may collapse before primary analysis. Inspector becomes a sheet when horizontal space cannot preserve readability.
At <= 640 px, use mobile task flow, five-item bottom navigation and prioritized table columns. Never keep three desktop panes stacked as one enormous page.

## Motion behavior

Use 120–220 ms for state and layout transitions. Values may briefly highlight on change. No blinking tickers, continuous pulsing health indicators or motion that competes with analytical reading. Honor reduced-motion preferences.

## Component acceptance

A component is production-ready only when it has keyboard semantics, 200% zoom behavior, reduced-motion behavior where applicable, loading/error/empty states, truth-state semantics, unit/timestamp handling where relevant, and route tests/screenshots proving it on the deployed origin.