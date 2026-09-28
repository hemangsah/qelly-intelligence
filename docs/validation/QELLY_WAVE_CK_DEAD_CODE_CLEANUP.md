# QELLY Wave CK — Decision Dead-Code Cleanup

## Scope

This wave performs the post-reinvention cleanup required by the Post-PR423 master prompt. Deletion is proof-first: compatibility aliases and currently rendered Decision components are retained.

## Removed

| Obsolete surface | Evidence | Action |
| --- | --- | --- |
| Legacy timeframe card layout | CSS references existed; current Decision route had zero markup references | Removed `.q-dpg-timeframe*` rules |
| Legacy side scenario panel | CSS references existed; current Decision route had zero markup references | Removed `.q-dpg-scenarios*` rules |
| Legacy range selection action row | CSS references existed; current range workbench has zero markup references to it | Removed `.q-dpg-selection-actions*` rules |
| Obsolete status icon style | CSS reference existed; current Decision route had zero markup references | Removed `.q-dpg-status-icon` rule |

## Already retired and verified

- The old native/flat asset selector is absent. The provider-capability picker remains authoritative.
- Old hero/range “Ask QELLY” controls are absent.
- The single bottom-center contextual QELLY dock remains. Its `data-dpg-open-chat` attribute is a compatibility integration hook on the new dock, not an old duplicate button.
- The new Range Selection 2.0 workbench remains authoritative.

## Intentionally retained

- `apps/web/public/assets/routes/decision-provenance.mjs` is a compatibility alias for historical hash links and delegates directly to the authoritative Decision route. It is not dead code.
- Dynamic action-tone classes and provider/model modules were not removed based on filename age or static string absence.
- Existing compatibility tests and route ownership remain intact.

## Deletion discipline

The existing runtime dead-code audit is reused. Its rule remains: only `DEAD` items with zero executable references are deletion candidates. Versioned names, compatibility aliases, generated files, tests, and active dependencies are not deletion proof.

## Boundaries

- No dependency upgrades.
- No provider/model/probability changes.
- No schema or migration changes.
- No public route removal.
- No compatibility alias removal.
