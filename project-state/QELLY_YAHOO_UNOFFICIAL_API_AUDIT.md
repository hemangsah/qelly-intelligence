# Qelly Yahoo Finance and Unofficial API Audit

Audited base: `26d2c9c453992b74dd3931d6b8b9489117d0b44c`  
Verified: `2026-07-29T16:55:00+05:30`

## Search scope

The full source snapshot, package manifests, lockfile, documentation, tests and generated pattern inventory were searched for Yahoo hostnames, quote/chart/spark/download endpoints, crumb/cookie flows, Yahoo packages, wrappers, HTML parsing, scraping and hidden provider fallbacks.

## Result

No official or unofficial Yahoo Finance production dependency was found. No Yahoo SDK/package is installed. No crumb/cookie/reverse-engineered request flow exists. Yahoo is retained only as a `DEPRECATED` / `REMOVE` regression record.

The repository contains explicit deterministic fixture fallback for live-market adapters. It publishes `source.mode=simulated` and a fallback reason; it is not a Yahoo fallback and must never be relabelled live.

## Regression requirements

- Core Qelly routes must not depend on Yahoo availability.
- `query1.finance.yahoo.com`, `query2.finance.yahoo.com`, crumb and cookie flows must fail audit validation if introduced.
- A future Yahoo integration requires a current official commercial contract, not endpoint renaming or an unofficial wrapper.
