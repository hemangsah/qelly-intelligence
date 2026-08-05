# Qelly Prompt 2B Green-Gate Evidence — 98663fd4

Repository: `hemangsah/qelly-intelligence`  
Branch: `feature/calculator-and-indicator-foundation`  
Draft PR: `#23`  
Exact head: `98663fd41bd9d2dc51fbe548ff3e9d01f8190865`  
Run: `30632528652`

## Independently verified aggregates

- Browser artifact `8794169557` (`qelly-prompt2b-browser-aggregate-98663fd41bd9d2dc51fbe548ff3e9d01f8190865`)
  - outer bytes: `91581100`;
  - outer SHA-256: `876a0860849a1357e528244aa2fed0f2b61687e85a97a01160379e137b3999c5`;
  - ZIP entries: `281`;
  - ZIP CRC: clean;
  - browser records: `1944/1944` passed;
  - shards: `27/27`;
  - unique case IDs: `1944`;
  - missing, duplicate and unexpected cases: `0`;
  - retries: `0`;
  - forced clicks: `0`;
  - browser, action, console, page, local-resource, overflow, navigation-overlap, blank-tail, font, truth-label, unlabelled-control, CLS, theme and performance failures: `0`;
  - internal checksum targets: `280`, missing `0`, mismatches `0`.

- Accessibility artifact `8794082089` (`qelly-prompt2b-a11y-aggregate-98663fd41bd9d2dc51fbe548ff3e9d01f8190865`)
  - outer bytes: `9935`;
  - outer SHA-256: `cb70c0f16b8cb4c15725578e51370d00b2c64bb8b20ba006774add3c58145cf5`;
  - ZIP CRC: clean;
  - checks: `54/54` passed across `27` routes and desktop/mobile;
  - retries: `0`;
  - forced clicks: `0`;
  - critical failures, missing checks and duplicate checks: `0`.

- Final retained review artifact `8794198034`
  - outer bytes: `91591463`;
  - outer SHA-256: `ddce96c9d05ff073d8678fc12fb66cdff448146ee1090fb49205a642789212b4`;
  - ZIP entries: `282`;
  - ZIP CRC: clean.

## Exact failure classification

The run conclusion is `failure` solely because `SAVED_CALCULATION_ACTION_REVIEW.json` reports:

`direct navigation/refresh failed for saved-calculation-detail/<new-id>`

The saved-action fixture installs this initialization script for every document load:

`localStorage.removeItem('qelly.calculations.v1')`

After the review creates and saves a calculation, its own direct-refresh helper reloads the page. The fixture initialization runs again and deletes the saved record before refresh is asserted. This is a **fixture defect**, not a product persistence, routing, numerical, API, schema or migration defect.

## Preserved invariants

- formulas: `151`;
- indicators: `54`;
- provenance: `FRESH_REIMPLEMENTATION_2026`;
- formula SHA-256: `3c7ac72e4ab6e5383e5e9aae90cc74508113c8d4c636c2efb7500df4ed49a98f`;
- indicator SHA-256: `3071eaac2a6a6dae24c8155a766e1db1ce8d26a2e6bf6ae30fb1ac594156087a`;
- routes/screens/APIs/schemas/smoke/migration: `70/429/202/72/290/108`;
- saved-calculation lifecycle, deterministic-local truth and persistence/isolation boundaries remain unchanged.

## Next action

Make the fixture reset one-time per review tab, rerun the saved-action acceptance only, then run one complete immutable `1944/54` pre-design matrix on the corrected exact head. Broad design mutation remains blocked until that complete gate and its artifacts are independently green.
