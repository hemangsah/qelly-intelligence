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
- PR #17: temporary post-merge verification only; must be closed without merge after final closeout-main verification

Prompt 2 and Prompt 3 have not been executed.

## Prompt 2A Wave 0 exact-head audit

- Audited source head: `eafb11719e67135c7a6fa3b15e1170c5192e4771`
- Workflow: `Qelly Prompt 2A Wave 0 Audit` run `30441613550` — success
- Standard exact-head workflows: CI `30441616525` success; Container Build `30441619817` success; Production Foundation Services `30441613552` success; CodeQL `30441616414` success
- Bootstrap artifact ID: `8719693609`
- Bootstrap artifact SHA-256: `a3a798edd016ea28bb5174f089d9948fd51f0b23edb7d480d9bf57613483156b`
- Internal bootstrap checksums: all passed
- Validation gates: environment, typecheck, lint, design governance, brand governance, secret scan, unit/integration tests, production build, frontend build, product validation, product inventory, full-stack smoke, production identity, release check, dependency audit and git diff check — all exit code 0
- Repository inventory: 721 files, 711 text, 10 binary; sanitized source snapshot contains zero font binaries
- Prompt 2A classifications are conservative; validation success does not convert fixtures/contracts/routes into connected product features.
- Branch protection read: HTTP 403 via Actions token; status unverified.
