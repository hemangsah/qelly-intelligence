# Qelly motion system

## Principles

Motion clarifies location, focus, state, and data change. It does not decorate every panel, loop values, hide evidence, or turn the analytical workspace into a cinematic page.

## Durations

- Instant: 90ms — focus and compact state acknowledgement.
- Fast: 150ms — hover, selected controls, table rows.
- Standard: 230ms — menus, command palette, tooltip continuity.
- Deliberate: 360ms — dock/rail, drawer, filter sheet, mobile bottom sheet.
- Cinematic: 720ms — future public/editorial scenes only.

## Easing

- Standard: `cubic-bezier(.2,.6,.2,1)`
- Enter: `cubic-bezier(.16,1,.3,1)`
- Exit: `cubic-bezier(.4,0,1,1)`
- Emphasized: `cubic-bezier(.2,.9,.15,1)`
- Ticker: linear

## Phase 0 behaviors

- Dock selection and hover use fast color/position feedback.
- Secondary navigation enters deliberately without shifting content.
- Layout modes update composition with stable dimensions.
- Table rows use fast hover and keyboard-focus feedback.
- Filter, column, and explanation surfaces use bounded drawers or mobile sheets.
- Chart crosshair and tooltip follow the selected observation without continuous value animation.
- Updated values may flash once in future live modes; static review values do not loop.

## Reduced motion

When `prefers-reduced-motion: reduce` or Signal Access is active:

- stop the market ticker;
- remove drawer/sheet travel;
- remove parallax and looping particles;
- preserve visibility, focus, selected state, chart values, and reading order;
- do not use scroll hijacking.

## Performance

Use transform and opacity for movement, fixed dimensions for analytical surfaces, CSS containment where useful, no constant heavy blur, no layout-thrashing value animation, and no public cinematic bundle on terminal routes.
