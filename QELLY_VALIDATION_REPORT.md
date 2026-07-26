# Qelly design-foundations validation report

Baseline commit: `5dd8b424426bc544bd2f925cfaeeea9a8fe6df6f`
Branch: `agent/design-foundations-shell`

## Audit evidence

- 61 executable routes;
- 187 declared API routes;
- 65 runtime JSON schemas;
- 17 domain contracts;
- 37 route modules;
- 35 route modules using the common `q-page` composition;
- 238 panel instances and 28 KPI grids across route modules;
- nine original static-preview routes before this batch;
- Decision Provenance graph/list/export contracts already present;
- no complete OI, funding, liquidation, basis, or options product domain;
- no Figma generator present despite the previous handoff claim.

## Batch validation

The following evidence is updated as commands complete:

| Check | Result |
| --- | --- |
| Design inventory | Passed: 61 routes, 411 frames, 40 components |
| Design foundations | Passed: 30 semantic tokens, 24 type roles, 9 domains, 6 personas, 25 Figma pages |
| Figma JavaScript syntax | Passed |
| Clean dependency install | Passed: `npm ci --ignore-scripts` with an isolated CI cache |
| Environment contract | Passed: development safety flags disabled |
| Typecheck | Passed: 169 files |
| Lint | Passed: 261 files |
| Focused Pages/design tests | Passed: 24/24 |
| Full automated tests | Passed: 276/276 |
| Runtime build | Passed: cold start and labelled simulated fallback verified |
| Product validation | Passed: 61 routes, 187 APIs, 17 contracts, 65 schemas, 44 required files |
| Product inventory | Passed: 537 source files |
| Full-stack smoke | Passed: 260/260 requests |
| Static Pages build | Passed: `dist/frontend`, `/qelly-intelligence/` base path, no API base |
| Pages compiled-artifact validation | Passed: 59 files, 0 secret findings |
| Pages route/asset smoke | Passed: 14 assets, direct-navigation fallback, 8 representative routes |
| Dependency audit | Passed: 0 vulnerabilities |
| Repository secret scan | Passed: 537 files, 0 high-confidence findings |
| Release check | Passed |
| Real-browser screenshots | Not run: this environment has no local Chromium/Playwright installation |
| Native Figma execution | Not run: requires Figma Desktop |

Automated results do not constitute independent accessibility, security, provider-licensing, or production-readiness certification.
