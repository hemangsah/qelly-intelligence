# Qelly Intelligence V6 - Institutional Terminal Design Lock

Status: implementation authority
Design generation: repository-native Figma-equivalent source
Canonical runtime: https://qelly-intelligence.pages.dev
Canonical architecture: Cloudflare Pages + Functions. GitHub Pages is a repository handoff only.
Product boundary: evidence-first, research-first, read-only financial intelligence. No trade execution, custody, transfers, withdrawals, wallet signing, private keys or money movement.

## 1. V6 design objective

Qelly V6 is one institutional workstation, not a set of unrelated dashboards. Every route inherits the same shell, typography, data-truth grammar, interaction model, provenance treatment and responsive behavior. Functional information density is preferred over decorative card density.

The user should be able to answer four questions on every analytical screen without opening documentation:

1. What am I looking at?
2. Where did the data come from?
3. How fresh and complete is it?
4. What can I safely do with it?

## 2. Canonical release architecture

Production user -> Cloudflare Pages shell -> Cloudflare Functions -> governed provider/service layer -> Supabase where persistence is required.

GitHub Pages -> canonical handoff -> Cloudflare production. GitHub Pages must not emulate a second API-backed terminal.

Release identity is visible in the system strip. A deployed UI is accepted only when its release SHA is traceable to the exact validated commit.

## 3. Visual language

### Surfaces
- Canvas: low-noise neutral surface.
- Primary workstation: dense analytical surface with 1 px semantic separators.
- Inspector: visually distinct evidence/provenance surface.
- Modal/sheet: elevated only when interaction requires focus.
- Failure/degraded state: never hidden behind decorative empty cards.

### Geometry
- Standard radius: 5-8 px.
- Control height: 30-36 px desktop, 40-44 px touch.
- Panel padding: 10-16 px depending density.
- Primary analytical grids should minimize dead space.

### Typography
- Body: 11-12 px desktop minimum.
- Utility/meta labels: 9-10 px, never used for primary instructions.
- Panel heading: 13-15 px.
- Route title: 18-25 px.
- Numeric values: tabular numerals.
- Long IDs and evidence keys: monospace.

### Brand semantics
Burgundy is Qelly's brand/accent and evidence color. It is not a universal loss/error color. Positive, negative, warning, stale, simulated, unavailable and conflicting states use separate semantic treatments plus text labels.

## 4. Global shell

### System strip
24 px target. Contains environment, release SHA, data-health summary, session state and clock. Health is derived from evidence, never a decorative green dot.

### Command bar
40 px target. Universal search/command entry, current context, alerts, profile/session trigger and keyboard shortcut affordance.

### Navigation rail
Collapsed 44-52 px; expanded 176-208 px. Route families: Markets, Discovery, Quant, Research, Portfolio, Evidence, Operations, Account.

### Context bar
32-36 px. Route title, breadcrumbs/context, instrument/provider/timeframe controls, freshness state and route actions.

### Workspace grid
When relevant, desktop uses context rail + primary analytical surface + evidence Inspector. The primary surface must remain dominant.

### Evidence Inspector
280-360 px docked desktop; bottom/full-height sheet mobile. Owns provider, truth state, observation time, freshness, coverage, confidence, method, fallback reason, entitlement/rights status and audit identifiers.

### Activity tray
32-40 px collapsed. API refresh, validation, import, alerts and evidence events. No execution/order controls.

## 5. Data truth grammar

Every data-bearing module uses one of these explicit states:

- LIVE - provider-authorized live public/display data.
- DELAYED - valid provider data with known delay/reference cadence.
- CACHED - valid cached data still within its cache policy.
- STALE - previously valid data outside the freshness target.
- PARTIAL - valid but incomplete coverage.
- CONFLICTING - material disagreement between sources.
- DEGRADED - a capability is functioning through a reduced/fallback path.
- SIMULATED - deterministic governed demonstration/test data only.
- UNAVAILABLE - capability/provider is intentionally disabled, not configured or failed without acceptable fallback.
- AUDIT - immutable evidence/review state.

A state chip is accompanied by provider/source and freshness context where financially material.

## 6. Live Markets workstation

The internal Qelly chart is a first-party SVG renderer. It consumes only the governed Qelly market envelope and performs no third-party runtime script loading.

Required chart capabilities:
- candlesticks;
- volume;
- SMA-20 reference overlay;
- crosshair inspection;
- responsive rendering;
- controlled streaming update method when the backend explicitly authorizes a live provider;
- no order-entry affordances.

Provider matrix behavior:
- Qelly Governed Demonstration is selectable and visibly SIMULATED.
- Binance remains disabled until redistribution/display rights are verified.
- Coinbase remains disabled until written end-user display permission is verified.
- ECB is approved only for attributed reference-rate use and is represented as reference/delayed data, not crypto-market live data.

The chart engine never determines truth state. Truth comes from the backend source envelope.

## 7. External market/research surfaces

External research is isolated from Qelly automated analytics.

### TradingView
Permitted implementation mode: official display-only widget or outbound research surface, with attribution and provider terms observed. TradingView widget values are not ingested into Qelly calculations, risk engines, price referencing or automated decisions unless Qelly separately obtains the required data rights.

### Forex Factory
Default implementation mode: outbound economic-calendar research card. Do not scrape, proxy or bypass framing restrictions.

### ECB
Official source/reference links may be surfaced alongside Qelly's governed ECB reference-rate capability. Reference-rate context must state cadence and reference-data purpose.

Each external surface displays:
- provider identity;
- purpose;
- mode: external display / outbound research / governed provider;
- data-flow boundary;
- third-party notice when applicable.

## 8. Research workspace

Three-column desktop pattern:
- left: workspace context, tags, revision and persistence state;
- center: evidence board/capture workflow;
- right: Intelligence Inspector with source references, contradiction/falsification boundary and production gates.

External research launchers belong in a clearly separated research-source strip. They never masquerade as stored Qelly evidence. A source becomes Qelly evidence only when the user intentionally captures a reference into the workspace.

## 9. Quant workbench

Calculators, formulas and indicators share one component family:
- searchable context/library column;
- validated inputs with units;
- formula/method section;
- result/output section;
- assumptions and provenance Inspector;
- reproducibility/save record;
- explicit distinction between user-supplied and provider-derived inputs.

Indicators additionally expose sampling/timeframe, warm-up requirements, parameters and interpretation caveats. No indicator is presented as a recommendation to trade.

## 10. Authentication and profile

Authentication must visually belong to the same terminal.

Sign-in/register/recovery states include:
- environment/release identity;
- deterministic request state;
- human-readable errors;
- recovery and passkey/MFA paths where configured;
- no indefinite spinner or blank shell.

Post-login profile/session surfaces include display identity, workspace membership, active workspace, MFA/passkey status, session/security controls, preferences and sign-out. Destructive account actions remain clearly separated.

## 11. Operations and provider health

Provider/API health screens use evidence tables rather than generic service cards. Minimum columns:
- capability;
- provider/service;
- policy/entitlement state;
- current health;
- last successful observation;
- freshness target;
- fallback;
- correlation/evidence reference.

A disabled-by-policy provider is not reported as an outage. An outage is not reported as disabled-by-policy.

## 12. Mobile contract

Reference viewport: 390 x 844.
- One primary analytical task at a time.
- Five-item high-frequency bottom navigation plus More/command access.
- Inspector becomes evidence sheet.
- Tables prioritize financially material columns and preserve identifiers.
- Minimum touch target 44 px where practical.
- Route/context state survives sheet and navigation transitions.
- 200% zoom remains usable.

## 13. Motion contract

- Micro transitions: 120-220 ms.
- Sheet/panel transitions: <=260 ms.
- Streaming values may use one brief change highlight.
- No continuous flashing, animated price hype or motion that blocks reading.
- prefers-reduced-motion removes nonessential motion.

## 14. Route migration groups

Wave A - Runtime truth
- Live Markets
- Advanced Chart
- Provider/API health
- Platform Readiness

Wave B - Identity
- Login
- Register
- Recovery
- Profile/session
- Security setup/passkeys

Wave C - Quant
- Calculator Center/detail
- Formula library/detail
- Indicator library/detail
- Comparison Lab

Wave D - Research
- Research Workspace/history
- Event Calendar
- Filing Workspace
- evidence/reference surfaces

Wave E - Portfolio/discovery
- Portfolio analytics/attribution
- Watchlists
- Asset Intelligence
- Rankings/screener/discovery

Wave F - Operations
- Data Mesh
- Delivery/stream operations
- Observability
- Migration/quarantine
- audit/security evidence

## 15. Acceptance gates

A V6 route is accepted only when all applicable gates pass:
1. functional DOM is authoritative;
2. no fake/synthetic overlay represents production truth;
3. explicit source/truth/freshness state is present;
4. backend rights/entitlement state controls live-provider presentation;
5. keyboard and 200% zoom remain usable;
6. responsive/mobile layout follows V6 contract;
7. reduced-motion behavior is valid;
8. empty/error/degraded states explain cause and next safe action;
9. no CSP-blocked or unapproved third-party runtime script is introduced;
10. repository tests pass on the exact SHA;
11. Cloudflare deploy succeeds on the same SHA;
12. public runtime/API smoke checks pass;
13. browser console/visual evidence is reviewed before final release acceptance.

## 16. Current V6 implementation decisions

Locked as of 2026-08-16:
- Cloudflare is the canonical dynamic terminal.
- GitHub Pages is a handoff only.
- API config/health/readiness use dedicated single-owner route handlers.
- Live Markets internal chart is first-party and CSP-safe.
- The browser runtime keeps script-src 'self'.
- Blocked Binance/Coinbase rights are shown as unavailable for live display, not worked around.
- Governed fixture market data remains explicitly SIMULATED.
- TradingView remains an external display/research surface boundary, not a Qelly analytics data source.

This document is the V6 design lock. Implementation may improve details, but any change that weakens provenance, read-only safety, CSP, provider-rights truth or Cloudflare canonicality is a regression unless explicitly re-approved.
