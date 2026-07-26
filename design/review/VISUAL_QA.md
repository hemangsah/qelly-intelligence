# Qelly UI rescue visual QA

Status: **manual screenshot assessment complete; user visual approval pending**.

Review commit inspected: `a729bb25729c024e855d5626bf5fb93894e8743b`

Artifact inspected: `qelly-ui-rescue-review`

Approved reference SHA-256: `ad6740c65f06ed74482ed28af991cce79158b96c5b23a196925f9cb7ee2620f2`

## Evidence reviewed

The reference and implementation were manually compared at:

- 1440×1000 desktop;
- 1024×768 tablet landscape;
- 768×1024 tablet portrait;
- 390×844 mobile.

The review also inspected the institutional table region, expanded product navigation, command palette, Explain Market Move drawer, light appearance, Scalper Velocity, Research Oracle, Signal Access, reduced-motion state, side-by-side comparisons, annotated differences, console report, geometry report, interaction report, and locally runnable compiled preview.

## Approximate visual fidelity

**Estimated directional fidelity: 86% overall.**

This is a manual composition-and-hierarchy estimate, not a conversion of pixel-difference ratios into a score. Desktop is closest to the approved reference direction; tablet remains close after responsive reflow; mobile intentionally diverges because the reference screenshot exposes a clipped navigation overlay while the rescue uses a usable compact top bar and five-item bottom navigation.

Approximate viewport assessment:

- desktop: 89%;
- tablet landscape: 87%;
- tablet portrait: 85%;
- mobile: 82% raw reference fidelity, with materially better usability than the reference capture.

## Geometry and composition findings

- Ticker height: 32px, matching the approved 30–34px target.
- Edge dock width: 72px, matching the approved 70–74px target.
- Command bar height: 70px, matching the approved 68–72px target.
- Main content offsets remain stable at the ticker-plus-command and dock boundaries.
- Desktop KPI layout contains six equal-height cards in one row; tablet reflows to three columns; mobile uses one column.
- Desktop chart-to-intelligence width is approximately 73% / 27%, within the approved 70–75% / 25–30% composition.
- The chart is visually dominant, source-labelled, stable, and explicitly marked demo/not live.
- The institutional table is full-width, dense, horizontally scrollable, keyboard-focusable, and uses sticky header/asset behavior with tabular numeric alignment.
- The mobile implementation stacks content cleanly and keeps critical navigation reachable without compressing the desktop dock.

## Critical differences

None found in the reviewed screenshots.

There is no navigation covering the implementation content in its normal state, no clipped primary heading, no false live-data claim, no inaccessible missing focus state in the command palette, no broken drawer state, and no production/persistence implication.

## Major differences

1. **The implementation’s desktop chart is taller than the approved reference.** At 1440×1000 the implementation table begins just below the initial viewport, while the reference exposes the table controls at the bottom of that viewport. The table itself remains a strong full-width institutional surface in the dedicated region and full-page capture, but its first-viewport prominence is lower than the reference.

## Minor differences

1. The implementation command shell is denser and includes more explicit Qelly product context than the reference; the route title is truncated in the compact shell region at some widths.
2. The implementation uses the repository’s legally usable typography stack instead of embedding an exact remote display font.
3. KPI sparklines, chart curvature, labels, and fixture values are not pixel-identical because the rescue uses Qelly deterministic observations and source metadata rather than copying the standalone reference dataset.
4. The implementation table is wider than the reference and intentionally truncates long provider copy within the visible source column before horizontal exploration.
5. Light mode is brighter and more analytical than the softer reference light treatment.
6. The Signal Access capture uses stronger outlines, 120% font scale, and reduced motion, which intentionally changes visual density.
7. The static preview has no dedicated empty-state switch; the review records this instead of fabricating an empty-state screenshot.

## Deliberate differences

1. The implementation adds stronger truth-state language: static visual preview, deterministic demo, backend unavailable, no production trading or persistence, demo/not-live source labels, and provider-unavailable warnings.
2. The implementation preserves Qelly provenance, source, confidence, freshness, and evidence vocabulary beyond the standalone visual reference.
3. The mobile rescue replaces the reference capture’s clipped/overlaid desktop navigation with a compact top bar, touch-sized actions, and bottom navigation.
4. The chart and ranking fixtures are Qelly-specific deterministic observations, not copied market data.
5. The table is deliberately wider and horizontally scrollable to preserve institutional columns and numeric alignment.
6. The approved HTML remains review-only, outside `dist/frontend`, and scheduled for removal before merge.
7. No production APIs, databases, Redis, storage, ClamAV, email, webhooks, custody, execution, or persistent mutations are represented by the review build.

## Interaction and safety evidence

- Required interaction result: passed.
- Reconciled required checks: 16/16 passed; the only non-required item is the documented absent empty-state switch.
- Command palette: opens with Ctrl/Cmd+K and focuses `#q-command-input`.
- Explain Market Move: opens a visible drawer and provides deterministic explanation steps.
- Signal Access: high-contrast persona, 120% font scale, reduced motion.
- Site-origin JavaScript errors: 0.
- Failed local resources: 0.
- Required review artifacts missing: 0.
- Public runtime config remains static-preview and backend-unavailable.

## Manual verdict

The rescue is suitable for **user visual review** and is substantially closer to the approved institutional Qelly direction than the rejected public interface. It should remain a draft because the taller desktop chart/table fold difference is material enough for the user to accept or request revision.

**DO NOT MERGE — USER VISUAL APPROVAL REQUIRED.**
