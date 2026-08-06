# Qelly Blueprint Audit — 2026-08-07

## Scope

This audit reconciles the current Qelly Intelligence implementation with the governed product blueprint, route inventory, visual system, truth-state rules, accessibility requirements, deployment architecture and public-beta boundaries.

## Accepted product state

- Canonical deployment: Cloudflare Pages.
- Vercel: intentionally unused for Qelly.
- Product boundary: intelligence, validation and decision support only; no execution, custody, deposits, withdrawals, private keys or autonomous investment decisions.
- Authentication registration and password recovery: fail-closed until transactional email delivery is independently proven.
- Public deterministic tools: available without an account.
- Governed route inventory: 70 registered routes.
- Required visual evidence: 140 full-page renders, comprising desktop 1440×1000 and mobile 390×844 for every registered route.

## Repairs completed

- Enforced route uniqueness and complete 70-route ownership.
- Enforced IBM Plex Sans, semantic color tokens, light, dark, OLED, high-contrast and adaptive appearance modes.
- Enforced focus-visible, reduced-motion, safe-area and color-blind market-palette contracts.
- Removed the broken font-preload dependency.
- Made Windows screenshot capture UTF-8, fail-fast and diagnostic-preserving.
- Added accessibility regression output to the final screenshot ZIP.
- Prevented Asset Rankings from blending provider observations into deterministic scenario rows.
- Reclassified Asset Rankings as a visible deterministic demonstration with unassessed provider agreement.
- Repaired Asset Rankings deep-link search, evidence export, provenance navigation, Escape handling and focus return.
- Replaced hard-coded Asia/Kolkata registration defaults with browser timezone detection.
- Added an explicit base-display-currency selector for global registration.
- Kept login usable when session-status preflight is temporarily unavailable.
- Aligned registration and recovery controls with the actual email-delivery capability.
- Corrected support, privacy, terms, beta and risk pages to use Cloudflare as canonical and avoid overstating authenticated cloud readiness.

## Release gates

The exact `main` commit containing this audit must pass:

1. Environment validation.
2. Type checking and linting.
3. Design-governance validation.
4. Secret and security scanning.
5. Complete automated tests.
6. Frontend production build.
7. Accessibility regression.
8. 70-route / 140-render screenshot capture with zero missing or failed routes.
9. One exact-commit ZIP containing screenshots, manifests, contact sheets, checksums and accessibility evidence.
10. Cloudflare production identity convergence.

## Manual external dependency

Brevo/Supabase transactional email authentication remains an external configuration dependency. Qelly must continue to reject registration and recovery requests until a real confirmation and recovery canary succeeds. No secret is recorded in this audit.
