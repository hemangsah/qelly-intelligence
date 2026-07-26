# Qelly accessibility standard

Target: WCAG 2.2 AA, with manual verification required before any production-readiness claim.

## Interaction

- Every action is keyboard reachable and has a visible `:focus-visible` treatment.
- Native controls are preferred. Composite widgets document arrow, Home, End, Enter, Space, and Escape behavior.
- Dialogs and modal drawers bound focus, close with Escape, and return focus to the trigger.
- Hover is supplementary. Touch, keyboard, and visible controls expose the same function.
- Essential touch targets are at least 44 by 44 CSS pixels on mobile.

## Structure and text

- Routes use named landmarks, a skip link, one clear page heading, and logical heading order.
- Essential text is never below 12px. Table text is normally 13–14px; interface body 15–17px; public editorial body 17–20px.
- Content reflows at 200% zoom and, where practical, at 400% without horizontal page scrolling.
- Latin, Devanagari, and future language content use language-safe system fallbacks and natural wrapping.

## Data and state

- Positive, negative, warning, evidence, stale, fallback, and unavailable states pair color with text and a symbol.
- Loading uses fixed geometry and `aria-busy` on the owning region.
- State changes are announced once; live regions are not used as a streaming log.
- Error text is associated with its control and includes recovery guidance.
- Demo, fallback, stale, estimated, derived, and unavailable values are explicit.

## Tables, charts, and provenance

- Tables retain caption, header scope, sort state, keyboard-operable column resizing, and a responsive alternative.
- Every chart requires a title, description, current range, key values, source, observation time, text table alternative, and downloadable data when licensing permits.
- A provenance graph always has a complete list/tree alternative with upstream and downstream meaning.
- Tooltips must also open by focus and are never the only source of essential information.

## Motion and contrast

- `prefers-reduced-motion` removes parallax, looping particles, and unnecessary transforms while preserving focus and chart interaction.
- Primary text targets 7:1 where practical; normal essential text is at least 4.5:1; large text and focus indicators are at least 3:1.
- High-contrast mode does not depend on translucent surfaces or subtle shadows.

## Verification

Automated checks are necessary but insufficient. Required manual coverage includes Chromium, Firefox, WebKit/Safari, keyboard-only use, screen reader review, 200%/400% zoom, high contrast, reduced motion, and realistic mobile/tablet profiles.
