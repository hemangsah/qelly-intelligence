# Qelly Intelligence — Terminal Design Source of Truth

Status: implementation contract
Design generation: internal repository-native design system (Figma-equivalent source)
Baseline: Qelly V5.3 institutional density lock + current production truth
Production target: https://qelly-intelligence.pages.dev
Scope: read-only financial intelligence terminal; no execution, custody, wallet signing, private-key handling, withdrawals, transfers, or money movement.

## 1. Product design objective

Qelly must behave as one coherent institutional terminal, not a collection of independent dashboards. Every production screen must use the same shell, evidence semantics, typography, density, responsive rules, interaction grammar, authentication states, and data-truth language.

The deployed Cloudflare terminal is the canonical user experience. Repository previews, screenshots, documentation, and test fixtures must converge on the exact same release behavior. Static fixtures may exist for testing and visual fallback, but production UI must never present them as live market data.

## 2. Non-negotiable truth contract

Every data-bearing module exposes, either inline or in Inspector:

- Source/provider
- Provider/legal mode: live-public, licensed, delayed, cached, reference, demonstration, unavailable
- Observation timestamp and retrieval timestamp when distinct
- Freshness / staleness state
- Confidence
- Coverage
- Method or transformation
- Fallback reason when degraded
- Audit / provenance identifier where available

User-facing states are explicit:

`FRESH` — current within the route's published freshness SLA.
`STALE` — previously valid data outside freshness SLA.
`PARTIAL` — valid but incomplete fields/instruments/regions.
`MISSING` — expected data absent.
`CONFLICTING` — sources disagree beyond tolerance.
`DEGRADED` — provider/API works partially or fallback is active.
`SIMULATED` — deterministic demonstration/test values only; never called live.
`UNAVAILABLE` — provider or capability intentionally disabled/not configured.
`AUDIT` — immutable/provenance review state.

A green dot alone is never enough. Text/icon/ARIA state must communicate meaning independently of color.

## 3. Shell architecture

### System strip — 24 px
Displays environment, release identity, data health, session state and a compact global clock. It must never imply provider health without evidence.

### Command bar — 40 px
Global search/command palette, current instrument/context, keyboard entry point, notification access and profile/session trigger.

### Semantic navigation rail — 44–52 px collapsed, 176–208 px expanded
Icon + accessible label. Families: Markets, Discovery, Quant, Research, Portfolio, Operations, Evidence, Account.

### Context bar — 32–36 px
Route title, breadcrumbs/context, relevant instrument/provider/timeframe selectors, freshness state and local route actions.

### Workspace
Desktop: analytical grid with context/support pane + primary work area + evidence Inspector visible together when the route needs all three. Do not prepend a second visual reference page above functional DOM.

### Inspector
Dockable 280–360 px panel. Owns provenance, source state, confidence, coverage, methodology, assumptions, contradictions, permissions and audit references. It is a first-class interaction surface, not a decorative card.

### Activity tray
Collapsible 32–40 px footer/tray for API events, data refresh, alerts, import activity, validation and background job status. No trade/order execution controls.

## 4. Density and typography

Desktop body: 11–12 px minimum.
Utility labels: 9–10 px minimum, used sparingly.
Panel headings: 13–15 px.
Route titles: 18–25 px depending hierarchy.
Numeric/KPI values: tabular numerals; do not oversize values solely for decoration.
Radii: 5–8 px standard.
Borders: 1 px semantic separators.
Whitespace: dense but deliberate; no giant consumer-dashboard cards.

Typography hierarchy must remain readable at 200% zoom. No text is clipped to preserve a dense visual composition.

## 5. Color semantics

Neutral dark/light surfaces use semantic design tokens rather than route-specific hex values.
Positive and negative market movement must use dedicated directional tokens. Burgundy is a brand/accent/evidence color and must not be the sole or default negative-market semantic.

Warning, degraded, stale, simulated and unavailable each have separate token/label treatment. Color is supplementary; icon/text/state labels remain mandatory.

## 6. Motion

Normal UI transitions: 120–220 ms.
Panel docking and modal/sheet transitions may use up to 260 ms when necessary.
No decorative auto-animation that delays reading data or interacting with controls.
Streaming values may use a brief non-blocking change highlight, never continuous flashing.
`prefers-reduced-motion` removes nonessential transitions and animated emphasis.

## 7. Desktop workspace patterns

### Market command pattern
Use for Market, Live Markets, Advanced Chart, Asset Intelligence, Rankings, Screener, Discovery and related routes.

Required layout: compact universe/context rail; primary chart/table/analysis surface; Inspector with provider/provenance/truth; activity/status strip. Data controls remain near the data they affect.

### Research / quant pattern
Use for Research Workspace, Filing Workspace, Comparison Lab, Formula/Indicator routes and analytical calculators.

Required layout: hypothesis/input context; reproducible calculation/research surface; assumptions/method/version; source citations and provenance in Inspector; save/export actions that do not imply investment advice.

### Portfolio pattern
Use for Portfolio Analytics/Attribution and watchlists.

Required layout: position/universe context; analytical surface; factor/attribution/risk context; provenance and coverage. Portfolio data must distinguish imported/user-supplied values from market-provider values.

### Operations/evidence pattern
Use for Data Mesh, Stream Operations, Delivery Operations, Platform Readiness, Observability, Quarantine, Migration and Security Evidence.

Required layout: health/queue/source topology; issue/action table; evidence Inspector; audit/activity tray. Never decorate a failing state as healthy.

### Account/auth pattern
Use for login, register, recovery, account/session, security setup, passkeys and profile/account controls.

Required layout: focused authentication card/workspace; clear environment and security state; human-readable errors; accessible password/passkey controls; recovery path; post-login profile/session view integrated into terminal shell. Authentication should feel like the same product, not a separate template.

## 8. Mobile contract

Reference viewport: 390 × 844.
One primary task at a time. Never stack desktop's full context + primary + Inspector vertically into a multi-thousand-pixel page simply to preserve every pane.

Five-item bottom navigation for the highest-frequency destinations, with More/command access for the full route graph.
Inspector becomes a bottom sheet or full-height evidence sheet.
Tables use intentional column priority, horizontal scroll only where financially necessary, and sticky identifiers when useful.
Touch targets target 44 px minimum.
Route state survives sheet/modal/navigation transitions.
All critical states remain usable at 200% zoom.

## 9. Data-provider UI behavior

Production rendering must be driven by a capability envelope returned by backend/runtime configuration, not hard-coded provider marketing labels.

A provider selector entry includes:
- provider id/name
- asset classes/markets supported
- entitlement/display rights
- transport type (REST/WebSocket/SSE/reference)
- live/delayed/reference status
- freshness SLA
- configured/healthy/degraded/disabled state
- terms/source link where allowed

If a provider is blocked by display/redistribution policy, its option may be shown disabled with a concise reason, or omitted. It must never be selectable into a fake live state.

Demonstration fixtures are a development/training fallback and must be visibly labeled `Demonstration data` or `Simulated`. They are not the target state for the production terminal when a permitted provider is available.

## 10. External research and embed surfaces

External integrations are modular cards/panels, never uncontrolled full-page iframe dumping.

Each integration has:
- provider identity
- purpose
- official/legal embed or outbound-link mode
- permission/CSP domain
- loading/error/unavailable state
- privacy/third-party notice where relevant

Approved official widgets can be embedded when provider terms and CSP allow it. Sites that do not provide an official embeddable surface must use a deep-link/outbound research card; anti-framing protections are never bypassed.

Candidate surfaces to verify before implementation include official TradingView widgets/charts, economic-calendar/macro sources, regulator/exchange filings, reference-rate providers, and canonical source links. Forex Factory should be linked/embedded only according to its current official capabilities/terms; do not scrape or frame around restrictions.

## 11. Authentication/profile experience

### Sign-in
- Qelly identity header + release/environment marker
- Email/password or configured passwordless/passkey capability
- visible loading state no longer than the underlying request
- deterministic errors: invalid credentials, unconfirmed email, rate limited, network degraded, session expired
- recovery link and security explanation
- no generic blank spinner

### Post-sign-in profile/session panel
- display name/email
- workspace membership and active workspace
- session age/last verification where safe
- MFA/passkey status
- security/recovery setup
- preferences, theme/persona, data-provider preferences
- sign out and authenticated self-delete separated as distinct risk levels

Profile reads must not be repeated by unrelated config/layout endpoints; route bootstrap should request only the context needed by that route.

## 12. Calculator / indicator / formula experience

All quantitative tools share one modern workbench:
- searchable library/context column
- explicit inputs with units and validation
- formula/method panel
- result panel with precision/unit controls
- assumptions and provenance in Inspector
- reproducibility record / saved calculation
- source timestamp for any market-derived input
- user-supplied input clearly distinguished from provider data

Indicator pages expose definition, parameters, input series, sampling/timeframe, warm-up requirements, output, interpretation caveats and reproducibility metadata. They do not present indicators as trading recommendations.

## 13. Empty, loading, degraded and failure states

No route may show an unexplained empty chart/table.

Loading: skeleton/progress + requested source/context.
No data: explain whether filter, provider coverage, entitlement, or absence caused it.
API error: name affected capability, not secret/internal details; provide retry and evidence link.
Degraded fallback: label provider/fallback and timestamp.
Offline/static visual preview: explicit banner, not a tiny footer.

## 14. GitHub ↔ Cloudflare parity contract

The release SHA rendered in the terminal must match the deployed Cloudflare build metadata.
Repository static fallback config is not treated as production truth. Build-time runtime config must be generated deterministically and validated after deploy.

Release acceptance requires:
1. repository tests green on exact SHA
2. Cloudflare build/deploy success on exact SHA
3. runtime configuration endpoint reflects intended feature/provider state
4. critical API smoke tests through public origin
5. authenticated route checks
6. desktop/mobile evidence generated from deployed origin
7. console/runtime error scan
8. CSP/third-party integration checks
9. provider truth-state checks

## 15. Design acceptance checklist

A route is migrated only when:
- real functional DOM is authoritative
- no synthetic reference overlay is loaded/prepended
- data states are truthful
- Inspector/evidence metadata exists where data is shown
- primary route workflow is complete
- responsive/mobile behavior follows this contract
- keyboard and 200% zoom pass
- reduced-motion behavior is valid
- source and provider failures are intelligible
- route is tested on exact deployed SHA

This document is the human-readable design authority. Machine-readable tokens and route-layout contracts live beside it and must remain synchronized with implementation.