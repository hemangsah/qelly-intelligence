# Part 18 Hardened Foundation and Wave 6 Decisions

## Decision 1 — fix integrity before adding breadth

Audit records now use recursively canonical JSON. Hash verification protects nested actor/details values, and a checkpoint sidecar detects record truncation. The checkpoint remains local and must not be represented as immutable production evidence.

## Decision 2 — make local persistence failure-recoverable

Atomic stores serialize updates through recoverable queues, lock the target file across store instances, flush temporary files and rename atomically. These controls improve local correctness but do not replace database transactions or distributed consensus.

## Decision 3 — scope user preferences correctly

Preferences are keyed by tenant, workspace and user. Each record has an optimistic revision. Stale writes return a 409 conflict rather than silently overwriting newer state.

## Decision 4 — remove static CSRF evidence

The configuration endpoint issues a random token bound to the local session. Production mode disables the fixture identity entirely, including explicit fixture-session headers.

## Decision 5 — enforce schemas truthfully

A dependency-free JSON Schema 2020-12 subset validates declared mutation inputs. The coverage API lists enforced routes and limitations. Broad production enforcement is intentionally not claimed.

## Decision 6 — begin modularization without a risky rewrite

Runtime construction and route manifests were extracted on the backend. The route registry and Asset Intelligence renderer were extracted on the frontend. Existing validated modules remain in place and will be decomposed incrementally.

## Decision 7 — deliver a narrow executable Wave 6 slice

Asset Intelligence supports deterministic profile, quote evidence, fundamentals, events, filing references, peers, comparison, SMA, EMA and RSI. MACD, Bollinger Bands, licensed statements, real filings, analyst data, corporate actions and advanced charting remain contracts or production dependencies.
