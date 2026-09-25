# QELLY Wave BL — Dead Code / Dependency Hygiene

Status: focused hygiene wave  
Base production: `7a68a34edd3f4edbcc5ffe64ffe46aa0d723a082`

## Rule

Wave BL does **not** delete code because a filename looks old.

The repository audit now classifies text/runtime inventory with the master-prompt taxonomy:

- `ACTIVE`
- `COMPATIBILITY`
- `GENERATED`
- `TEST`
- `DEPRECATED`
- `DEAD`

A runtime/build asset is a deletion candidate only when it has **zero executable references** across runtime, build scripts, tests and workflows. Documentation references are retained in the audit but do not make a dead runtime asset executable.

Run:

```bash
npm run audit:dead-code
```

The command writes `validation/RUNTIME_DEAD_CODE_AUDIT.json`.

## Proven-dead removals in this wave

### Superseded local Geist packages

Removed from `package.json` and `package-lock.json`:

- `@fontsource-variable/geist`
- `@fontsource-variable/geist-mono`

Evidence:

- the production frontend build copies only `@fontsource-variable/ibm-plex-sans`;
- the local comparison workflow reads IBM Plex, Manrope and Plus Jakarta directly from `node_modules`;
- the historical remote comparison script may fetch a Geist candidate from jsDelivr, which does not require the local Geist npm packages;
- design validation now explicitly requires the active local packages and verifies that the superseded Geist packages are absent.

## Important non-deletion discovered by the audit

The following stylesheets initially looked superseded but are **not dead**:

- `apps/web/public/assets/premium-font-surface.css`
- `apps/web/public/assets/premium-font-surface-polish.css`
- `apps/web/public/assets/premium-font-worldquant-arkham.css`

`qelly-premium-reset.css` imports all three. Therefore they remain executable style/compatibility layers and are classified `COMPATIBILITY`, not `DEAD`.

This is the intended BL behavior: deeper reference analysis overrules filename-age heuristics.

## Explicitly retained

- `@fontsource-variable/ibm-plex-sans` — production self-hosted font build.
- `@fontsource-variable/manrope` — local typography comparison candidate.
- `@fontsource-variable/plus-jakarta-sans` — local typography comparison candidate.
- `playwright` — browser, visual and cross-browser validation.
- `pngjs` — image-level visual correction/inspection tooling.
- `pg` — PostgreSQL runtime/tooling.
- imported font-surface compatibility CSS — executable through `qelly-premium-reset.css`.
- versioned `*-v2/-v6/-v7` assets with executable references — retained; version naming alone is not deletion proof.
- `docs/archive/**` — classified `DEPRECATED`, but retained as historical documentation rather than runtime code.

## Audit improvements

The existing `scripts/runtime-dead-code-audit.mjs` now:

1. emits the required taxonomy;
2. records executable-reference counts separately from documentation references;
3. marks legacy/compatibility/recovery/rescue and imported historical font-surface layers as `COMPATIBILITY` when executable references remain;
4. audits npm dependencies for direct imports or explicit `node_modules` access;
5. exposes a strict deletion rule: only `DEAD` items with zero executable references qualify.

## Non-actions

- No imported CSS was removed after an executable `@import` reference was found.
- No route alias was removed without route-registry/inventory proof.
- No test was removed because it looked old.
- No environment variable was removed without proving it is unused by build/runtime/workflows.
- No generated validation artifact is treated as runtime code.
- No dependency was removed solely because GitHub search returned zero results.

## Acceptance

Wave BL is complete only when:

1. focused hygiene tests pass;
2. full repository tests/build/security/browser gates stay green;
3. the IBM Plex production font build remains unchanged;
4. imported compatibility layers remain classified and referenced;
5. remaining dependencies are classified active by executable evidence;
6. the two removed local Geist packages stay absent from the lockfile.
