# Local MT5 worker lifecycle and responsiveness

Based on fetched production 93d3ab25ea55ba13aca7cfbde7429281a47c5a26 after PR #504.

The standalone MT5 Analyzer previously parsed and calculated closing-deal metrics on the UI thread. A prior current-host Node benchmark measured 30,000-deal XLSX parsing at approximately 1.8–2.1 seconds; this was not browser responsiveness evidence.

The standalone route now transfers local file bytes to a same-origin module worker that calls the existing bounded HTML/XLSX parser and unchanged descriptive metrics. Worker completion returns derived analysis. Clearing, replacing, resetting or leaving a route terminates active workers and invalidates generations. Clear controls are available during processing. Worker errors, missing support, unreadable messages and a 45-second limit fail visibly without a synchronous fallback. No remote worker service, raw-file persistence or network upload is added. Verify processing remains a separate performance follow-up.

Unit tests independently exercise transferred-buffer ownership, cancellation/late messages, safe parser errors, worker failure/timeouts, missing support, 5 MB bounds and unchanged omitted metrics. Required Browser E2E exercises a 20,000-deal synthetic HTML file, observes the actual local module worker, checks frame callbacks while parsing and cancels in-flight processing; all existing HTML/XLSX/comparison/share-safe/route-cleanup checks remain required. These are synthetic acceptance tests, not broker authenticity or market outcome evidence.

Exact-head Browser E2E, immutable preview and production convergence are required before delivery is declared.

Full local suite: 2,120 passed, one skipped, zero failures with unchanged test set at concurrency 4. The initial unconstrained Windows run hit process-spawn failures; no test was removed or skipped to resolve that environment limit.
