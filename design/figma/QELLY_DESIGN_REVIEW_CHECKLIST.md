# Qelly font, surface and command-palette design review checklist

## Typography

- [ ] Candidate board was reviewed before the final family was selected.
- [ ] Geist Sans Variable is the display/UI target and Geist Mono Variable appears only in evidence-grade metadata and numeric roles.
- [ ] No more than two visible font families are used.
- [ ] Page, section, module, metric, body, label, table and metadata roles are visibly distinct.
- [ ] 700/800 weights are exceptional rather than routine.
- [ ] Table cells are 13–14px and headers are 11.5–12.5px.
- [ ] Uppercase and tracking are limited to useful compact labels.
- [ ] Local WOFF2 loading creates no visible layout shift or external blocking request.

## Visual direction and surfaces

- [ ] Neutral institutional surfaces dominate.
- [ ] Burgundy is an accent, not a canvas fog or panel fill.
- [ ] Gradients are rare and purposeful.
- [ ] Normal panels rely on tone, spacing and selective dividers rather than hard outlines.
- [ ] Obvious bordered cards are reduced by at least 35% against the rejected baseline.
- [ ] High-opacity normal-panel borders are absent.
- [ ] Shadows are limited to palettes, sheets, drawers and menus.
- [ ] The warm porcelain light mode is designed independently rather than inverted or pink-tinted.

## Continuous corners and controls

- [ ] 4/6/8/10/12/14/16/20/24/28/pill radius roles are used by purpose.
- [ ] One radius does not dominate all components.
- [ ] Nested palette geometry is 20px outer, 12px search, 10px results and 8px shortcuts.
- [ ] Buttons and inputs use 40–44px standard targets; compact controls remain 32–36px.
- [ ] Selects use custom SVG indicators and no native browser appearance.
- [ ] Focus rings are separate from ordinary borders and remain visible.

## Command palette

- [ ] The palette uses a neutral floating surface with a continuous 20–24px outer corner.
- [ ] There is no separate dated title bar or hard separator.
- [ ] Search is integrated and has no bright pink rectangular outline.
- [ ] Recent, Navigation, Assets and Actions groups are visible.
- [ ] Every result has an SVG icon, title, description/category and shortcut chip.
- [ ] Selected rows use a soft tonal fill with no hard white outline.
- [ ] Desktop width is 680–760px; mobile uses a fluid modal treatment.
- [ ] Focus trap, Escape, arrows, Enter and result-count announcement work.
- [ ] Reduced motion removes travel while preserving focus and result meaning.

## Market product

- [ ] Rankings table remains a primary first-screen surface.
- [ ] Desktop market pulse is one continuous six-cell surface with subtle internal separation.
- [ ] Mobile market pulse is a horizontal snap rail with roughly 2.25 metrics visible.
- [ ] Breadth and regime read as compact strips rather than isolated KPI cards.
- [ ] Chart preserves realistic OHLC, volume, axes, crosshair, tooltip and source information.
- [ ] Chart frame uses fewer borders, a larger plot ratio and modern segmented controls.
- [ ] Discovery, Terminal and Research layouts preserve their task differences.
- [ ] Derivatives pressure, source, freshness, confidence and evidence remain visible without noise.
- [ ] Explain This Move remains reachable from row, chart and intelligence modules.

## Table

- [ ] Outer table shell is 14–16px with overflow clipping; rows themselves are not rounded.
- [ ] Row hierarchy, height and hover tone are improved.
- [ ] Sticky header and sticky asset column remain intact.
- [ ] Horizontal dividers are subtle.
- [ ] Star and quick evidence actions are visually quiet until relevant.
- [ ] Direction, confidence, source and freshness are not communicated by color alone.

## Mobile

- [ ] No desktop rail, squeezed table or 2×2 bordered KPI grid remains.
- [ ] Compact top bar, context tabs, one preview indicator, title and mode selector are present.
- [ ] Horizontal pulse rail, breadth/regime strips, search and compact ranking header are present.
- [ ] Asset rows are 52–64px with subtle dividers and expandable details.
- [ ] Filters and columns use continuous-corner bottom sheets.
- [ ] Bottom navigation respects safe areas and is not visually heavy.
- [ ] No clipping or horizontal page overflow at 360, 390 and 430 widths.

## Accessibility, motion and performance

- [ ] WCAG 2.2 AA contrast and non-color states are preserved.
- [ ] Keyboard navigation, focus containment and focus return are verified.
- [ ] Table semantics and chart text summary remain intact.
- [ ] Reduced motion removes travel and loops but preserves meaning.
- [ ] Touch targets and zoom/reflow behavior are annotated.
- [ ] Only selected variable WOFF2 ranges are shipped; candidate fonts remain review-only.
- [ ] No expensive repeated masks, excessive blur or constant shadow repaint exists.

## Truth and originality

- [ ] Static review state is stated once clearly.
- [ ] No unsupported live, provider, persistence or execution claim exists.
- [ ] No reference logo, copy, exact layout, proprietary data, chart skin, CSS or animation is reproduced.
- [ ] Generator-derived evidence is not described as a hosted Figma export.
- [ ] Every generated master frame and correction board is opened and reviewed before a quality claim.
