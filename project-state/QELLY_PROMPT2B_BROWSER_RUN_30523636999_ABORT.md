# Qelly Prompt 2B Exact-Head Browser Abort

## Evidence identity

- Run: `30523636999`
- Job: `90809474561`
- Exact head: `6e143bfa745fd5b83e033731c008e4533b16e132`
- Artifact ID: `8751954826`
- Artifact bytes: `12270935`
- Artifact SHA-256: `64555f54318c8f37e17c49f86590bde2434a81f3eeac17bc954160cfb35f7b0c`
- Artifact entries: `30`
- Artifact CRC: passed

## Gate results

The installed-source manifest, repository validation, formula tests, security scan, release checks, production identity isolation and dependency audit passed before browser execution. The dependency audit reported zero vulnerabilities.

## Browser result

The browser script did not complete a record matrix. It aborted at `scripts/prompt2b-final-review.mjs:176` after `page.waitForFunction` exceeded 10 seconds following a Calculator Center calculate-button click. The run therefore produced partial screenshots only and cannot support a pass/fail count for the complete 1,080-case matrix.

This is classified as a browser-harness orchestration defect: an individual action timeout escaped the per-record evidence model and terminated the entire run. It is not waived and it is not counted as a product pass.

## Required correction

- retain the real Playwright click;
- retain the deterministic post-click assertion;
- capture action timeout/error details in the individual record;
- add a hard `action-error` failure reason;
- continue executing the remaining records;
- write a progress checkpoint after every record so another unexpected abort remains classifiable;
- preserve all browsers, viewports, themes, motions, routes and existing assertions.

## Product-source boundary

No product source, formula catalog, indicator catalog or expected product output may change until the resulting complete browser artifact is downloaded and classified.
