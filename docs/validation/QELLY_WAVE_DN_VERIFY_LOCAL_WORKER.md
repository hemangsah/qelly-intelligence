# Verify local worker lifecycle

Reconciled from fetched production 380b1cd992ee09552c6cb7c4a68d6ed2e490d93a after PR #505.

Verify primary CSV/MT5 parsing, descriptive MT5 metrics, bounded general heuristics and source fingerprint composition now run in a one-use, same-origin module worker. Comparison reports use the existing local MT5 worker. Source rows never return from the workers. The UI retains the existing public engine API for compatibility; upload interactions use worker tasks. No network upload or synchronous fallback is added.

Replacement, clear, methodology entry and route exit cancel active jobs and invalidate generation ownership. Comparison clear is available during reads and analysis. The existing client enforces safe failures and a 45-second bound. Accessible busy state tracks active primary and comparison jobs.

An independent equivalence test compares the full stable CSV evidence core and normalized source fingerprint with the existing engine. Limited MT5 samples continue to withhold the minimum-five general engine. Existing full-suite parser, metrics, policy and route contracts remain required; location assertions now inspect the worker processor. Local full suite: 2,123 passed, one skipped, zero failures at concurrency four.

Mandatory Browser E2E additionally observes the actual Verify worker, frame callbacks during a synthetic 20,000-deal analysis and in-flight cancellation. All existing input races, route leave, HTML/XLSX, charts, exports, comparison, hostile-file and light/dark checks remain required. These are synthetic research acceptance tests, not broker authenticity, genuine market outcomes or calibrated probabilities. Exact-head preview and production acceptance remain pending until verified.
