# Global chat keyboard containment

Closing chat previously left keyboard focus on the document body. The full-screen
mobile assistant also exposed background controls to keyboard navigation and
reported itself as non-modal.

Opening records the current focused control. Escape and Close restore it when
still available, with the launcher or main region as fallback. The delayed input
focus is cancelled on close. On mobile, the assistant reports aria-modal=true,
makes page siblings inert and cycles Tab/Shift+Tab inside visible enabled chat
controls. Existing inert state is retained. Breakpoint changes update the modal
boundary and restore only siblings made inert by chat.

The required browser job verifies three representative global routes in both
themes at desktop/mobile widths (12 cases), 70 Tab movements in each mobile case,
resize transitions, Escape, Close, rapid open/close, prior inert state and zero
chat POSTs. It preserves screenshots and a machine-readable report. This extends
global keyboard acceptance without claiming complete independent WCAG coverage.
