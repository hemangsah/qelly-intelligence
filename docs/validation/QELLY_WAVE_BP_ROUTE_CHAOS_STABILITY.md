# QELLY Wave BP — Route / Chaos Stability

Release base: `25f9f9f24da9fc47ca4ea34ec78493103956d468` (post-Wave BO / PR #418).

## Objective

Wave BP upgrades the existing mandatory Browser E2E first-paint/stability gate so it repeatedly exercises the Decision workspace rather than only proving static route rendering.

## Existing coverage retained

The same browser release gate already measures:
- cold and warm rendering across representative routes and viewports;
- six Market → Decision → News → Calculator route cycles;
- forced-GC Chromium heap;
- DOM nodes, documents and event listeners;
- FCP, LCP, CLS, INP and long tasks;
- first-party network and console/page errors;
- duplicate shell/header regressions.

## Added Decision chaos coverage

The new probe performs six Decision stress cycles with:
- rapid asset changes;
- rapid timeframe changes;
- 1:1 / 1:2 / 1:3 / 1:4 / Custom / Auto R:R changes;
- repeated governed scanner attempts;
- at least three full page refreshes;
- at least eighteen Decision recomputations;
- a bounded idle window followed by a resume interaction.

The probe records after forced GC:
- JS heap;
- DOM nodes;
- documents;
- event listeners;
- pending timeouts/intervals;
- iframe count;
- first-party network failures;
- console/page errors.

## Deterministic failure boundary

Decision and scanner API calls are intentionally answered with a controlled HTTP 503 in this browser probe. That isolates lifecycle/cleanup behavior from external-provider variance and makes the test fail on UI/runtime instability without inventing candles, prices, scenarios, setups or candidates.

This is a resilience/stability test, not a trading-performance test.

## Release gate

The browser gate fails if:
- any monitored resource shows sustained material growth above the defined thresholds;
- duplicate shells/headers appear;
- required repeated Decision/scanner/refresh coverage is not actually observed;
- idle/resume cannot complete;
- unexpected first-party network or console/page errors occur;
- the chaos probe itself is unavailable.

No existing Browser E2E, accessibility, responsive, Web Vitals, long-task or route-cycle threshold is weakened.
