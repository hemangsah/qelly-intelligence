# Part 17 Public Discovery and Federated Search Decisions

## 1. Additive release ancestry

Part 17 treats the Part 12.7 checksum freeze and Part 14–16 releases as immutable ancestry. Wave 5 code is isolated under `src/discovery/`, new frontend route renderers, one contract, four schemas and dedicated evidence files.

## 2. Deterministic normalized public universe

The local universe contains 24 canonical entities across crypto, equities, funds, FX, commodities, indices, rates and tokenized fixtures. Missing specialized data remains `null` or absent. Values are never replaced by fabricated zeroes.

## 3. Federated search

Search combines assets, categories, venues, DEX pairs, news, research, methodologies and application commands. Ranking is deterministic text weighting with stable tie-breaking. Pagination uses opaque cursors. Production indexing, semantic search and relevance evaluation remain deferred.

## 4. Public discovery domains

The service exposes overview, rankings, category, venue, DEX, charts, prediction, news, research, methodology, coverage and status read models. Detail endpoints return explicit lineage and fixture boundaries. Prediction and converter results are marked non-tradable.

## 5. Saved-state governance

Saved searches, screens and compare trays are low-risk but still require authenticated local context, `discovery:write`, CSRF, idempotency and audit. Persistence is atomic local JSON and scoped by user and workspace. Cloud sync is false.

## 6. Trust and safety

The status payload and discovery contract expose machine-readable disabled flags for external providers, licensed feeds, trading, transfers, withdrawals, private keys and recovery phrases. Local attestations are explicitly self-verified and not external audits.

## 7. Traceability policy

Wave 5 requirements are not blanket-marked complete. Each of the 179 records is classified as implemented-local, partial-local or production-deferred. Specialized live/licensed metrics remain partial until their provider, entitlement, methodology and operational gates exist.

## 8. Next dependency wave

Wave 6 should build asset intelligence and the chart platform on top of the current canonical identity, time-series, streaming, discovery and search layers. Production provider onboarding remains a separate gated program.
