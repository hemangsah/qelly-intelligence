# Qelly Prompt 2B — Final bounded historical-run retrieval

Recorded on 2026-07-31 under the controlled fast-track authorization.

## Historical identity

- Repository: `hemangsah/qelly-intelligence`
- Historical producer head: `cb85761b3ff9928aae8cfdada9f4be67985de97c`
- Run: `30586896812`
- Failed job: `91020348079`
- Artifact: `8778077242`
- Authoritative artifact SHA-256: `9c43f18c4411520cb146e2882090ffc3d3cf643fb659ee43b603509aa16021e9`
- Superseded incorrect SHA-256: `22cb6cdf54bee071178bdb7b239f333a282e6bc5e09af3cf908c26adefba9cb2`
- Artifact bytes: `125939131`
- ZIP entries: `507`
- ZIP CRC: clean
- Contents: `506` screenshots and `.prompt2b-review/PROGRESS.json`
- Aggregate matrix: `1944` attempted, `1515` passed, `429` failed, `0` theme failures, `0` performance failures

## Final bounded retrieval classifications

| Primary record | Classification | Evidence boundary |
|---|---|---|
| Run metadata | `RETRIEVED_COMPLETE` | Run identity, producer SHA, workflow identity and conclusion were returned by GitHub. |
| Job metadata | `RETRIEVED_COMPLETE` | Job `91020348079` and its conclusion were returned. |
| Job step summaries | `RETRIEVED_COMPLETE` | Exact-head, setup, governance, repository, numerical, persistence, isolation, security, design and release steps passed; browser matrix step failed; downstream accessibility/action/package steps were skipped; retained-evidence upload passed. |
| Full decoded historical job log | `CONNECTOR_RESPONSE_UNREADABLE` | The GitHub connector produced a response resource, but the resource could not be read. This operation will not be repeated in later continuation turns. |
| Job annotations | `API_NOT_EXPOSED` | No connected GitHub action exposes the historical job annotation collection. |
| Producer workflow source | `RETRIEVED_COMPLETE` | `.github/workflows/prompt2b-wave1-review.yml` was retrieved at the producer SHA. |
| Producer harness source | `RETRIEVED_COMPLETE` | `scripts/prompt2b-final-review.mjs` was retrieved at the producer SHA. |
| Artifact metadata | `RETRIEVED_COMPLETE` | Artifact ID, size, dates and GitHub digest were retrieved. |
| Retained artifact bytes | `RETRIEVED_COMPLETE` | Downloaded independently; outer SHA-256, byte size, entry count and ZIP CRC were verified. |
| Per-case JSON/JSONL | `NEVER_GENERATED` | The historical harness wrote aggregate `PROGRESS.json`; it did not emit one durable record per case. |
| Complete assertion report | `NEVER_GENERATED` | No complete per-case assertion report was created by the historical harness. |
| Complete trace bundle | `NEVER_GENERATED` | The retained artifact contains screenshots but no complete per-signature trace bundle. |
| Complete 429-row failure ledger | `NOT_RETAINED` | It cannot be reconstructed solely from the retained historical artifact. |

## Historical accounting boundary

The historical `429` global failure count and the earlier derived `432` family-total count remain an unresolved historical accounting contradiction. The retained evidence does not support a complete reconstruction. Run `30586896812` is preserved only as historical aggregate evidence and is not accepted as immutable exact-head final approval.

No later work may claim that the missing historical per-case evidence was recovered. Fresh sharded JSONL evidence replaces it prospectively without rewriting history.
