# Qelly Prompt 2B Saved-Lifecycle Focused Acceptance — 4a700270

Repository: `hemangsah/qelly-intelligence`  
Branch: `feature/calculator-and-indicator-foundation`  
Draft PR: `#23`  
Exact focused head: `4a700270857542cdfcc03e6a74626651ea232430`

## Root-cause closure

Run `30632528652` on `98663fd41bd9d2dc51fbe548ff3e9d01f8190865` proved `1,944/1,944` browser and `54/54` accessibility records but failed saved-action acceptance because the review fixture removed `qelly.calculations.v1` on every reload. The fixture reset is now one-time per review context.

The first focused saved-action rerun `30639520767` exposed two additional exact issues:

- the CSV assertion expected an unsafe unquoted header even though the product emits the correct RFC-style `"field","value"` header; this was corrected as a harness assertion without weakening the required data-row check;
- the saved share URL attempted to encode the full current record plus repeated revision result payloads and exceeded the governed URL-share limit; the product now shares current deterministic evidence plus compact revision metadata only, while JSON export retains the complete local record.

No numerical formula or indicator behavior, API contract, schema, migration, isolation scope or persistence ownership changed.

## Saved-action focused review

- Run: `30640195491`
- Job: `91187879204`
- Artifact: `8797095609`
- Artifact name: `qelly-prompt2b-saved-action-focused-4a700270857542cdfcc03e6a74626651ea232430`
- Outer bytes: `928`
- Outer SHA-256: `66884b500ade0fe6842371d0ce0a3ad9bce5f75f3da30997b4d90e0ae0c05e89`
- ZIP entries: `1`
- ZIP CRC: clean
- Inner report bytes: `3070`
- Inner report SHA-256: `dc66f58da6e6fd4366384c9884b80fc525dfaf8ed31b47f8b9d953d30878666d`
- Status: `passed`
- Evidence actions: `19`
- Failures: `0`
- Retries: `0`
- Forced clicks: `0`

Accepted actions include direct navigation and refresh, create/save/reopen, rename/update, revision restore, JSON and CSV export, compact share URL generation, duplicate/delete, library export, clear/import/reopen, calculator shared-state restoration, saved shared-state restoration, local copy and console cleanliness.

## Affected-route matrix

Controlled focused run: `30640195602`

- Chromium saved-calculation-detail browser shard: `72/72` passed;
- saved-calculation-detail accessibility: `2/2` passed;
- browser aggregate artifact `8797290212`: `3,180,230` bytes, SHA-256 `208d424bd8be8e4c446e165ab35705fcfd5a7234400647b81ccdc448e2ad2ea5`, `21` entries, ZIP CRC clean, `20` internal checksum targets;
- accessibility aggregate artifact `8797311400`: `4,762` bytes, SHA-256 `b52201206a789e2f94d9e70765d68e98b79267caeb463eb38fb1e32406a28c15`, `8` entries, ZIP CRC clean, `6` internal checksum targets;
- zero missing or duplicate cases/checks;
- zero browser, accessibility, theme, action, console, page, resource, overflow, navigation, blank-tail, font, truth-label, unlabelled-control, CLS or performance failures;
- retries and forced clicks: `0/0`;
- focused gate job `91189891924`: `success`.

All specialist workflows on the exact focused head completed successfully.

## Protected invariants

- formulas: `151`;
- indicators: `54`;
- provenance: `FRESH_REIMPLEMENTATION_2026`;
- formula aggregate SHA-256: `3c7ac72e4ab6e5383e5e9aae90cc74508113c8d4c636c2efb7500df4ed49a98f`;
- indicator aggregate SHA-256: `3071eaac2a6a6dae24c8155a766e1db1ce8d26a2e6bf6ae30fb1ac594156087a`;
- routes/screens/APIs/schemas/smoke/migration: `70/429/202/72/290/108`;
- deterministic-local truth, saved-calculation lifecycle and persistence/isolation boundaries remain preserved.

## Next authoritative gate

Remove the temporary focused workflow, restore acceptance mode and freeze the resulting exact head for one complete immutable `1,944`-browser and `54`-accessibility acceptance matrix. Broad world-class design mutation remains blocked until that complete gate and every artifact are independently verified.
