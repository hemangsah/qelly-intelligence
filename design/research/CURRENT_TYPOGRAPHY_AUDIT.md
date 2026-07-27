# Qelly current typography audit

## Scope

This audit covers the rejected PR #11 Asset Rankings screenshots and the source that produced them at commit `03c63d73e6d92eb6376317337a50f329c201d134`. It does not infer a font that was not loaded.

## Rejected implementation

- The premium route declared `Inter, Geist, IBM Plex Sans, Noto Sans Devanagari, system-ui, sans-serif`.
- The shell declared the same stack with `Inter` first.
- No `@font-face` existed in the premium CSS and no WOFF/WOFF2 asset was copied by `build-frontend.mjs`.
- Therefore the named `Inter`, `Geist` and `IBM Plex Sans` faces were not guaranteed by the review build; the browser used the first locally available face and otherwise the platform fallback.
- The table used a separate `IBM Plex Mono, Geist Mono, JetBrains Mono, ui-monospace` stack without shipping those fonts.
- Page title: 34px / 600 / 1.04 / -0.04em.
- Table cells: 12px; numeric cells: 11px.
- Table headers: 9px / 550 / uppercase / 0.055em.
- Multiple labels and module headings used 9–10px uppercase text.
- Font loading contributed no network CLS because no webfont was loaded; that was not evidence of correct typography.

## Candidate comparison

The PR-only review renders the same title, section, metric, body, button, tab, table header, table row, command result and mobile title in:

1. rejected fallback stack;
2. Geist Sans Variable;
3. Manrope Variable;
4. Plus Jakarta Sans Variable;
5. selected Qelly system.

All candidate packages are Fontsource variable packages under SIL Open Font License 1.1. Candidate files are used only to generate the comparison board. The application build copies only the selected Geist Sans and Geist Mono Latin variable WOFF2 files.

## Selected system

- UI and display: **Geist Sans Variable** (`Qelly Geist`).
- Evidence mono: **Geist Mono Variable** (`Qelly Geist Mono`).
- Visible family count: two.
- UI weight range used by the corrected analytical route: approximately 400–620.
- Mono is restricted to timestamps, identifiers, formulas, provenance metadata and tabular numeric values.
- `font-optical-sizing:auto`, `font-synthesis:none`, and `font-variant-numeric:tabular-nums lining-nums` are required.
- Fonts are copied into the static build and loaded from the repository base path. There is no blocking third-party font request.
- The PR-only browser report records final computed families, loaded resources, WOFF2 sizes, used weights, line heights, tracking, fallback state and layout-shift entries.

## Role map

| Role | Corrected range |
|---|---|
| Page title | 42–52px desktop; 36–44px tablet; 28–32px mobile; 590 weight |
| Section title | 22–28px; 560–600 weight |
| Module title | 15–18px; 550–590 weight |
| Metric XL | 30–38px; 590–600 weight |
| Metric | 20–27px; 560–590 weight |
| Body | 14.5–16px; 400–450 weight; 1.45–1.6 line height |
| Compact body | 13–14px; 400–460 weight |
| Table cells | 13–14px; 420–520 weight |
| Table headers | 11.5–12.5px; 540–600 weight; limited uppercase |
| Labels | 11.5–12.5px; 500–560 weight |

## Evidence boundary

The repository document records source-level facts. Actual browser-computed values are generated into `reports/CURRENT_TYPOGRAPHY_COMPUTED.json` in the PR-only review artifact and are the authoritative rendered evidence.
