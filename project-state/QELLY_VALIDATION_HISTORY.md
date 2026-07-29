# Qelly Validation History

## PR #13 approved and merged foundation

- Approved head: `6fabb1ac65d73cde25d1dca6d63a6685ef7d7e9a`
- Merge/main: `94fbd4ff91c0d61f87e42724038f03fa5c36f97a`
- Merge tree comparison: identical, zero file differences
- Review ZIP SHA-256: `b2b10a6b80bb45cb10faf6173d39c4b2d9bb0893039da1b9936878189b1f492c`
- Inspection PDF SHA-256: `66d2d7cb656d25a8b6b7011bc6818c2f3f8db33ce7f051e95b2a35999b99a9c9`
- Compiled preview SHA-256: `fa528379f1cc1ef4d4446aaf832b8e0d7b88e924b6c2f51ef17d73fc878ba39d`

## Exact-main push workflows

- Continuous Integration — run `30426913360` — success
- Container Build — run `30426913315` — success
- Production Foundation Services — run `30426913312` — success
- CodeQL — run `30426913323` — success

## Post-merge independent validation

- Complete exact-main repository gates: passed
- Secret scan: passed
- Dependency audit: passed
- Production identity isolation: passed
- Release safety: passed
- Local browser matrix: 24/24 passed
- Browsers: Chromium, Firefox, WebKit
- Critical routes: market, Asset Rankings, Theme Studio, Theme Gallery
- Viewports: 360×800 and 1440×1000
- Console/page/resource failures: zero
- Horizontal overflow: zero
- IBM Plex and logo loading: passed
- Public deployment and browser smoke: passed

## Public-beta bootstrap validation

- Public-beta contract tests: passed
- Brand-freeze governance tests: passed
- Product validation: 61 routes, 187 API contracts, 17 contracts, 67 schemas
- Full-stack smoke: 260 requests passed
- Generated inventory: 61 routes and 276 API references
- Exact final PR #14 workflow matrix: pending connector-authored final handoff head
