# Post-BP runtime evidence repair

Base release: `a5810aaa861fb6af3d53b85f7a2b7a2c6d3b534b`.

This repair changes validation/evidence logic only.

## Public Runtime

The deployed runtime at the BP release was proven converged to the exact release SHA and the browser captured:

- `appReady=true`;
- `themeReady=true`;
- visible application shell;
- no startup-failure surface;
- no page errors;
- no CSP console errors.

The verifier nevertheless failed because it counted the intentional `application/ld+json` SEO schema block as an executable inline script.

The verifier now distinguishes non-executable JSON-LD / JSON data blocks from executable inline JavaScript. Executable inline scripts remain a release failure, and CSP console errors remain a release failure.

## BP chaos summary

Wave BP's actual chaos gate used `requestCounts.decision` and `requestCounts.scanner` and passed its minimum request-coverage checks. The printed summary later overwrote the correct scanner count with a duplicate key referencing a nonexistent field.

The duplicate/misleading aliases are removed. The summary now reports Decision/scanner request counts exactly once from the same authoritative counters used by the gate.

No Decision calculation, provider policy, route behavior, CSP policy, SEO schema, trading logic, calibration rule, R:R rule, or product capability changes in this repair.
