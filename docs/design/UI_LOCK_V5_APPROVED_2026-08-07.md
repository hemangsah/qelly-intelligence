# Qelly Intelligence — UI_LOCK_V5 Approval Record

Status: **APPROVED / ACTIVE**

Approved by the product owner in ChatGPT on 2026-08-07.

## Approved design candidate

- Candidate: `QELLY_UIUX_V5_FEATURE_COMPLETE_APPROVAL_CANDIDATE`
- Complete design ZIP SHA-256: `74ad171d0d191ab192e975d38c838b85ec288c4c48c2ad3628bf197f4694336a`
- Full design + rendered snapshot delivery SHA-256: `f1859fd5fe3ca5c07ec576d1980615f6e2d3d35800e50e709a0972ae2c4e5b27`
- Real rendered snapshot corpus: 2,067 lossless PNGs mapped 1:1 to editable SVG frames.

## UI_LOCK_V5 freezes

1. Qelly's modern institutional visual tone: neutral/dark foundations, burgundy identity, continuous semantic curvature, orbital/Bezier spatial geometry and restrained depth.
2. IBM Plex Sans Variable as the canonical product font. Theme/persona selection may not replace the font family.
3. Seven-layer workstation hierarchy: system strip, command surface, navigation, context ribbon, dockable analytical workspace, intelligence inspector and activity centre/tray.
4. Current governed 70-route taxonomy and alias policy unless a separately reviewed route-topology reconciliation changes it.
5. Theme Intelligence architecture: 13 curated theme families, six personas, 24 mindsets, four Aggressive Alpha levels, six visual packs, Theme Studio/Gallery, scheduled/system appearance, scoped preferences, safe import/export and accessibility validation.
6. Feature-parity requirements from the 151-point V4.1 audit.
7. Explicit disposition of all 400 historical screen concepts so no historical capability disappears silently.
8. Evidence-first truth model and envelope: source, observedAt, ingestedAt, freshness, confidence, coverage, method, assumptions, contradictions, limitations, version and auditId.
9. Truth states: loading, partial, fresh, stale, delayed, estimated, user-entered, derived, simulated, missing, conflicting, degraded, permission-limited and error.
10. Responsive posture, keyboard/focus/accessibility contracts and reduced-motion parity.
11. Read-only product safety: no custody, wallet signing, deposits, withdrawals, transfers or live order execution. Historical execution screens remain explicitly superseded or simulation-only.
12. No-silent-feature-removal rule. Existing functionality may be reconciled or enhanced but not removed without explicit product decision.

## Implementation authorization

This approval authorizes the next process:

1. refresh exact repository/PR head;
2. diagnose existing baseline CI/public-runtime/all-screen failures;
3. upgrade the frontend to V5 while preserving all current functionality;
4. validate frontend exact-head behavior across routes, states and viewports;
5. only after frontend stabilization, upgrade backend/API/provider/Supabase/security/observability mappings;
6. run exact-head release gates.

## Explicit exclusions

This UI approval does **not** authorize:

- merging PR #84 or any successor PR to `main`;
- promoting a Cloudflare preview to production;
- creating a Vercel project merely for deployment symmetry;
- weakening Supabase RLS/security boundaries;
- sending secrets by email;
- enabling live trading/custody/wallet behavior.

Production merge/promotion remains a separate explicit authorization gate after all required release checks pass.
