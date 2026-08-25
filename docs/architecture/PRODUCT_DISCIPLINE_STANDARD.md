# Qelly product discipline standard

This is the governing standard for new customer-facing work. It complements
`ACTIVE_PRODUCT_RUNTIME.md` and prevents another stack of prompt-, wave-, or
visual-version-specific implementation layers.

## Product structure

- Route modules own domain content, data mapping and page layout.
- `qelly-product-experience.css` owns global color, radii, elevation, focus,
  target size, motion, responsive interaction and dark/light behavior.
- `qelly-product-experience.mjs` owns shared interaction normalization only.
- `functions/api/v1/` owns Cloudflare request validation and response envelopes.
- Supabase owns authenticated persistence behind RLS; browser code never holds
  a service-role credential.

New files use capability names such as `portfolio-analytics.mjs` or
`provider-readiness.mjs`. Do not create names containing prompt numbers,
implementation waves or rolling visual versions. Existing numbered migrations
and evidence assets are immutable audit history, not examples for new work.

## Interaction contract

Every visible control must have an accessible name, visible keyboard focus and
an honest disabled or busy state. Standard controls use a 40px minimum target;
compact mobile controls use 44px. Inline editorial links are exempt, but source
and provider actions must expose the full target size. External links always
use `noopener noreferrer`. Reduced-motion users must not receive route or hover
animation.

Destructive actions require explicit language and a confirmation boundary.
Testing must not activate sign-out, deletion, delivery, credential rotation or
other irreversible controls against production.

## UI contract

- Prefer tonal grouping and spacing over boxes around every region.
- Use 10px controls, 12px working surfaces and 16px feature surfaces.
- Burgundy is an accent and state signal, not a full navigation fill.
- Status colors communicate truth independently from decorative themes.
- Empty states explain what is unavailable, why, and the next safe action.
- Never display internal enum values, raw exceptions or invented market data.

## Backend contract

- All exposed tables use RLS and ownership predicates.
- Authenticated writes validate identity server-side.
- `SECURITY DEFINER` functions are permitted only for bounded, documented RPCs
  with an explicit `auth.uid()` gate, fixed search path and least privilege.
- API responses expose stable customer-safe errors and a release identity.
- Health and readiness remain distinct: health proves the process is serving;
  readiness proves required production dependencies.

## Completion gate

A release is complete only after the full unit suite, lint, typecheck, design
and brand validation, connected/static builds, all-route browser evidence,
mobile interaction checks and exact-SHA Cloudflare convergence pass.
