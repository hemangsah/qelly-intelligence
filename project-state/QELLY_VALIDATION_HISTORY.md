# Qelly Validation History

## PR #13 approved and merged brand foundation

- Approved head: `6fabb1ac65d73cde25d1dca6d63a6685ef7d7e9a`
- Merge/main foundation: `94fbd4ff91c0d61f87e42724038f03fa5c36f97a`
- Merge tree comparison: identical, zero file differences
- Review ZIP SHA-256: `b2b10a6b80bb45cb10faf6173d39c4b2d9bb0893039da1b9936878189b1f492c`
- Inspection PDF SHA-256: `66d2d7cb656d25a8b6b7011bc6818c2f3f8db33ce7f051e95b2a35999b99a9c9`
- Compiled preview SHA-256: `fa528379f1cc1ef4d4446aaf832b8e0d7b88e924b6c2f51ef17d73fc878ba39d`

## PR #14 public-beta foundation review and merge

- Starting base: `94fbd4ff91c0d61f87e42724038f03fa5c36f97a`
- Exact reviewed head: `20e34c77add21d3d0c1f1db62949948e77768fea`
- Merge commit: `46233298031372c51bb433229bd7f9d1aff70568`
- Merge timestamp: `2026-07-29T08:26:52Z`
- Merge method: exact-head guarded merge commit
- Approved-head/merge-result comparison: identical, zero file differences
- Scope verdict: architecture and governance foundations only

### Exact reviewed-head workflows

- Continuous Integration — run `30435329025` — success
- Container Build — run `30435329090` — success
- Production Foundation Services — run `30435326590` — success
- CodeQL — run `30435329206` — success

### Exact main push workflows

- Continuous Integration — run `30435545787` — success
- Container Build — run `30435545830` — success
- Production Foundation Services — run `30435545836` — success
- CodeQL — run `30435545815` — success

### Repository and product gates

- dependency review: passed
- secret scan: passed
- environment and high-risk safety locks: passed
- type and syntax checks: passed
- lint and repository policy: passed
- governed design foundations: passed
- complete tests: passed
- production build: passed
- standalone frontend build: passed
- product validation and inventory rebuild: passed
- full-stack smoke: passed
- database identity isolation: passed
- release safety: passed

### Deployment validation

- Public URL: `https://hemangsah.github.io/qelly-intelligence/`
- Deployment ID: `5654166920`
- Successful status ID: `16077977388`
- Environment URL: `https://hemangsah.github.io/qelly-intelligence/`
- Public URL HTTP: 200
- Manifest HTTP: 200
- IBM Plex resource HTTP: 200
- Truth label: static/read-only preview; no connected-backend claim

## Public-beta inventory baseline

- routes: 61
- API references: 276
- schemas: 67
- server API contracts: 187
- contract families: 17
- truth states: 13

Inventory presence is not proof of implementation or provider connectivity.

## Administrative audit cleanup

- PR #15: closed without merge; closure comment `5114979271`; branch preserved
- PR #16: closed without merge; closure comment `5114983361`; zero changed files at closure; branch preserved
- PR #17: temporary post-merge verification only; closed without merge

## Prompt 2A Wave 0 exact-head audit

- Audited source head: `eafb11719e67135c7a6fa3b15e1170c5192e4771`
- Workflow: `Qelly Prompt 2A Wave 0 Audit` run `30441613550` — success
- Standard exact-head workflows: CI `30441616525` success; Container Build `30441619817` success; Production Foundation Services `30441613552` success; CodeQL `30441616414` success
- Bootstrap artifact ID: `8719693609`
- Bootstrap artifact SHA-256: `a3a798edd016ea28bb5174f089d9948fd51f0b23edb7d480d9bf57613483156b`
- Internal bootstrap checksums: all passed
- Validation gates: environment, typecheck, lint, design governance, brand governance, secret scan, unit/integration tests, production build, frontend build, product validation, product inventory, full-stack smoke, production identity, release check, dependency audit and git diff check — all exit code 0
- Repository inventory: 721 files, 711 text, 10 binary; sanitized source snapshot contains zero font binaries
- Prompt 2A classifications are conservative; validation success does not convert fixtures/contracts/routes into connected product features
- Branch protection read: HTTP 403 via Actions token; status unverified

## Prompt 2A final Wave 0 closure validation

- Latest fully validated Wave 0 content head: `e2e2dd822e7811406ea5b220dbd033bfad75f09b`
- Exact final closure head: `b6e92339994464c8022cdb2c180430c7ae1bcfc9`
- Qelly Prompt 2A Wave 0 Audit — run `30457557216` — success
- Continuous Integration — run `30457556292` — success
- Container Build — run `30457562053` — success
- Production Foundation Services — run `30457567030` — success
- CodeQL — run `30457562115` — success
- Browser route matrix: 61 routes × 3 browsers × 3 viewports = 549 records; 549 passed; 0 failed
- Registry validator: passed; 545 unique master features, 61 routes, 187 APIs, 28 providers and 188 formulas
- Retained repository gates: 16/16 exit code 0
- Review artifact ID: `8726334844`
- GitHub artifact digest: `07d6bf7ebc2125722fc7d48914e7146309979a2f69a71eaf64f26076fc88ad67`
- Inner review ZIP SHA-256: `75acdd3063d341b071afd87d96a04dfea1489c34efb1c55a7160a5ccbdcc3ae8`
- Inner review ZIP: 406,549 bytes; 73 entries; 52/52 internal checksums; CRC passed; zero prohibited font binaries
- The WebKit login-route failure in prior run `30452493946` was an audit-harness `innerText` false negative; product behavior was not changed

## PR #19 guarded merge

- Exact reviewed head: `b6e92339994464c8022cdb2c180430c7ae1bcfc9`
- State before merge: open, draft, unmerged, mergeable
- Changed files: 47
- Commits: 33
- Unresolved review threads: zero
- Scope verdict: audit/state/scripts/read-only workflow only; no Prompt 2B product source
- Merge method: merge commit with expected-head guard
- Merge commit: `202fccc8ab5722005ed0672b31d0a8ca3b5d4744`
- Merge timestamp: `2026-07-29T14:46:29Z`
- Source/merge-result tree: identical; zero file differences

## PR #20 refreshed exact-head validation and guarded merge

- Recorded initial head: `97bcccec58dedfe491dc36321a17b584f5b196b4`
- Final reviewed head after normal merge refresh and temporary-harness cleanup: `24666670bbb490056d733ac9f9eb5b9fa4a56521`
- Base after PR #19: `202fccc8ab5722005ed0672b31d0a8ca3b5d4744`
- Final diff: exactly `apps/web/public/assets/routes/live-markets.mjs` and `tests/live-market-truth-label.test.mjs`
- Full browser/repository regression on identical product tree: 549 records passed
- Final-head workflows: CI `30464067025`, Container Build `30464068115`, Production Foundation Services `30464067250`, CodeQL `30464068258` — success
- Unresolved review threads: zero
- Merge method: merge commit with expected-head guard
- Merge commit: `ea16ac3ff71aae9c000772189e472e68cf876b44`
- Merge timestamp: `2026-07-29T15:08:42Z`
- Source/merge-result tree: identical; zero file differences

## Exact final Program A main verification

- Exact product main: `ea16ac3ff71aae9c000772189e472e68cf876b44`
- Push CI `30464423457` — success
- Push Container Build `30464423362` — success
- Push Production Foundation Services `30464423489` — success
- Push CodeQL `30464423524` — success
- Independent verification workflow `30468965105` — success
- Complete repository gates: passed
- Affected truth route browser matrix: 72/72 passed across Chromium, Firefox and WebKit; 360×800, 390×844, 430×932, 768×1024, 1024×768 and 1440×1000; dark, light, OLED and high contrast
- Horizontal overflow: zero
- Unexpected console errors: zero
- Page errors: zero
- Failed required resources: zero
- IBM Plex and approved Qelly logo loaded
- Truth label, execution-disabled and no-custody assertions passed
- Expected third-party chart loading fallback was classified explicitly and no required local resource failed
- Verification artifact ID: `8730823864`
- Verification artifact digest/SHA-256: `14b8cf6780ef26c5dd193fa8cabfe25beaf5ab4ef138f86738e19922f1adaadd`
- Verification artifact size: 1,841 bytes
- Verification entries: 2
- ZIP CRC: passed

## Exact final Program A deployment

- Pages deployment ID: `5659934988`
- Deployment status ID: `16094492801`
- State: success
- Environment URL: `https://hemangsah.github.io/qelly-intelligence/`
- Public URL HTTP: 200
- Manifest HTTP: 200
- Truth label: public static/read-only visual preview; not a connected full production product

## Prompt 2B start gate

- Prompt 2B has not started in this closeout record
- Required branch: `feature/calculator-and-indicator-foundation`
- Base: exact resulting main after guarded merge of closeout PR #21
- Required draft PR title: `Qelly Prompt 2B — calculator, India finance and indicator foundation`
- No external provider credential is required
- Keep Prompt 2B draft, unmerged and undeployed
