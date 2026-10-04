# Missing Decision evidence stays unavailable

Reconciled against fetched release cdb2dda299f446faa39c50590c35f7bc949c1577 after PR #506. Existing Post-PR423 Decision Intelligence remains intact.

An observed canonical NO TRADE view displayed missing stops and targets as $0.00 and withheld setup/scenario probabilities as 0.0%. Display guards used Number.isFinite(Number(value)); Number(null) produces zero. These are missing observations, not measured zero prices or calibrated zero probabilities.

A shared finite-evidence predicate now accepts finite numbers and nonempty numeric strings, rejecting null, undefined, whitespace, booleans, arrays and objects. Decision numeric displays and scenario normalization use it. Genuine numeric zero remains a valid value. Missing setup probability stays UNCALIBRATED, missing monetary evidence stays Unavailable and absent obstructions are not rendered as zero-priced barriers. No decision engine, trade structure, provider entitlement or calibration gate changes.

Unit coverage tests missing shapes versus genuine zero and the existing retail view model's omitted levels/probabilities. Mandatory Decision Browser E2E compares omitted fixture fields with rendered stop, setup-probability and scenario headings; fixtures must exercise withheld scenarios. Existing selection, scanner, calibration, provenance and mobile acceptance remain required.

Reconciled full local suite: 2,125 passed, one skipped, zero failures at concurrency four. Exact-head preview and production acceptance remain required before delivery is declared.
