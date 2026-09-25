# QELLY Wave AY — Decision Research Note

## Objective

Add a structured, downloadable research note from the one authoritative Decision Intelligence snapshot without adding a provider request, a second Decision engine, model inference, persistence, execution behavior, or private free-form storage.

## Output contract

`qelly.decision-research-note/1.0.0` includes:
- asset, timeframe, horizon, observed time, truth state and primary provider;
- research thesis derived from the existing QELLY VIEW;
- QELLY VIEW action, evidence quality/confidence and what changes the view;
- strongest supporting evidence and contradiction;
- entry, stop, layered invalidation, expiry and target ladder;
- requested/selected R:R, structural feasibility and gross/net cost state;
- independent scenario-calibration diagnostics;
- authenticated real target-touch calibration only when its aggregate is actually available;
- bull/base/bear scenarios and terminal bounds;
- verified event-risk state;
- bounded Evidence Graph/provider source inventory;
- explicit limitations.

The downloadable representation is Markdown so it can be archived or reviewed outside QELLY without carrying raw candle arrays or private conversation text.

## Architecture

- pure formatter: `apps/web/public/assets/decision-research-note.mjs`;
- one secondary `Research Note` action in the existing Decision hero;
- the existing Decision payload is the only data input;
- authenticated target-touch calibration is accepted only as an optional already-loaded aggregate from the existing setup ledger;
- no API endpoint, provider fetch, LLM call, database table or persistence path is added.

## Scientific boundaries

- evidence confidence is not success probability;
- scenario calibration and real target-touch calibration remain separate;
- uncalibrated scenario diagnostics remain diagnostic only;
- target-touch probability is never synthesized from scenario probabilities, historical analogs or candle depth;
- net R:R remains unavailable when cost inputs are unavailable;
- unavailable event/macro/options/on-chain/liquidation evidence remains unavailable;
- NO TRADE / WAIT notes do not manufacture entry, targets or execution instructions.

## Privacy boundary

The note does not store or include:
- user identity;
- authorization/cookies;
- raw prompts or QELLY Chat conversation text;
- private free-form research history;
- service credentials;
- raw provider payload bodies or full candle arrays.

## Product boundary

Research only. The note is not investment advice, a recommendation, execution authorization or a guaranteed outcome.
