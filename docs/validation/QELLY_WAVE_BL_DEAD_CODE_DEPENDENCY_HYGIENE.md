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

### Superseded font stylesheets

Removed:

- `apps/web/public/assets/premium-font-surface.css`
- `apps/web/public/assets/premium-font-surface-polish.css`
- `apps/web/public/assets/premium-font-worldquant-arkham.css`

Evidence:

- none is linked from `apps/web/public/index.html`;
- none is injected by `scripts/build-frontend.mjs` or `scripts/finalize-public-runtime.mjs`;
- the active production font contract is `qelly-font-governance.css` + self-hosted IBM Plex;
- a Wave BL test scans executable roots and fails if any surviving executable file references a removed basename.

These files belonged to superseded Geist / typography-experiment stages and are not needed for compatibility routing.

### Superseded Geist packages

Removed from `package.json` and `package-lock.json`:

- `@fontsource-variable/geist`
- `@fontsource-variable/geist-mono`

The production frontend build now copies only `@fontsource-variable/ibm-plex-sans`. The local comparison workflow uses IBM Plex, Manrope and Plus Jakarta. A separate historical comparison script may fetch a Geist candidate from jsDelivr, which does not require the local Geist npm packages.

## Explicitly retained

- `@fontsource-variable/ibm-plex-sans` — production self-hosted font build.
- `@fontsource-variable/manrope` — local typography comparison candidate.
- `@fontsource-variable/plus-jakarta-sans` — local typography comparison candidate.
- `playwright` — browser, visual and cross-browser validation.
- `pngjs` — image-level visual correction/inspection tooling.
- `pg` — PostgreSQL runtime/tooling.
- versioned `*-v2/-v6/-v7` assets with executable references — retained; version naming alone is not deletion proof.
- `docs/archive/**` — classified `DEPRECATED`, but retained as historical documentation rather than runtime code.

## Non-actions

- No route alias was removed without route-registry/inventory proof.
- No test was removed because it looked old.
- No environment variable was removed without proving it is unused by build/runtime/workflows.
- No CSS asset was removed solely because it was not linked directly from the source index; executable references are checked too.
- No generated validation artifact is treated as runtime code.

## Acceptance

Wave BL is complete only when:

1. focused hygiene tests pass;
2. full repository tests/build/security/browser gates stay green;
3. the IBM Plex production font build remains unchanged;
4. removed assets have no executable references;
5. remaining dependencies are classified active by executable evidence.
