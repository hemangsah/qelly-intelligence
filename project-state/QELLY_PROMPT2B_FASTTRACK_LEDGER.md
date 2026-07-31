# Qelly Prompt 2B controlled fast-track ledger

## Checkpoint FT-000 — verified start

- Live feature head: `4a733ae29c499a8be3dc6751ad95ec97e1b969df`.
- Main/base: `9cb98780893924ad26fbf4baaa9048e80a162b2c`.
- PR #23: open, draft, unmerged, undeployed; auto-merge disabled.
- Commits after the recorded head: zero.
- Immutable recovery ref: `recovery/prompt2b-pre-design-4a733ae` verified identical to `4a733ae29c499a8be3dc6751ad95ec97e1b969df`.
- Immutable evidence ref: `evidence/prompt2b-run-30586896812-cb85761b` verified identical to `cb85761b3ff9928aae8cfdada9f4be67985de97c`.

## Checkpoint FT-001 — bounded old-run closure

- Historical run `30586896812` remains aggregate evidence only.
- Historical full log: `CONNECTOR_RESPONSE_UNREADABLE` after one bounded retrieval pass.
- Historical per-case JSONL/assertion/trace evidence: `NEVER_GENERATED` or `NOT_RETAINED` as recorded in `QELLY_PROMPT2B_OLD_RUN_FINAL_RETRIEVAL.md`.
- The historical 429-versus-432 contradiction is preserved unresolved; no further repeated archaeology is authorized.

## Checkpoint FT-002 — fresh pre-fast-track classification

Exact-head run `30606919952` on `4a733ae29c499a8be3dc6751ad95ec97e1b969df` produced 1,944 complete aggregate records and artifact `8784954275`.

- Artifact SHA-256: `e35ce8234cf42addcf1bdbda5b7b34ef4cb18d1954a365b57a0ae3f93116f538`.
- Bytes: `121609680`.
- Entries: `507`.
- ZIP CRC: clean.
- Passed: `1520`.
- Failed: `424`.
- Navigation-clearance assertions: `265`.
- Action assertions: `243`.
- Overlap between those families: `84`; exact union: `424`.
- Trusted-action observation timeouts: `195`.
- Obstructed saved-detail update cases: `24` at width `390`.
- Obstructed calculator-detail calculate cases: `24` at width `768`.
- Theme failures: `0`.
- Performance failures: `0`.

The navigation calculation used only the document scroller and focused the last action with `preventScroll`, producing large negative clearances even where captured screenshots showed unobscured fixed navigation. The trusted-action observer stored evidence only in a page global and then polled it for three seconds; fresh instrumentation replaces that fragile observer with synchronous session-storage evidence from exactly one trusted pointer click. These are harness corrections, not numerical or persistence changes. Fresh shards remain authoritative for final classification.

## Checkpoint FT-003 — CI upload classification

Continuous Integration run `30606919936` is green on the starting head. Both `validate` and `dependency-review` passed, and `Upload validation evidence` passed. The earlier separate upload defect is classified `RESOLVED_BEFORE_FASTTRACK_MUTATION`; executable CI validation remains unchanged.

## Instrumentation contract

The canonical fast-track pipeline provides:

- 27 browser shards: 3 browsers × 9 Prompt 2B routes;
- exactly 72 cases per shard: 9 viewports × 4 appearances × 2 motion modes;
- incremental fsync-backed `SHARD_RESULTS.jsonl`;
- one record per completed case with exact head, workflow/harness blobs, action state, assertions, browser errors, layout metrics, trusted-click count, screenshot and trace identities;
- failed screenshot for every failed case;
- first local occurrence trace for each normalized signature, with global deterministic signature aggregation;
- checksum, missing, duplicate, conflict and counter reconciliation;
- 9 accessibility shards, 3 routes and desktop/mobile per shard;
- a complete 54-check aggregation with the automated-accessibility truth boundary retained;
- no retries and no forced clicks.

## Safety state

Broad product UI/UX and Figma mutation is not authorized until one frozen exact head passes every repository gate, all 1,944 browser cases, all 54 accessibility checks, saved-action review, static-preview validation, checksum verification and final artifact integrity.
