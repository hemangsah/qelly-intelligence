const state = { lastFocused: null };

export function installAccessibility(root = document) {
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') document.documentElement.dataset.input = 'keyboard';
    if (event.key === 'Escape') {
      const dialog = root.querySelector('dialog[open]');
      if (dialog) closeDialog(dialog);
    }
  });
  root.addEventListener('pointerdown', () => {
    document.documentElement.dataset.input = 'pointer';
  }, { passive: true });
  ensureLiveRegion(root);
}

export function ensureLiveRegion(root = document) {
  let region = root.getElementById('qelly-live-region');
  if (!region) {
    region = root.createElement('div');
    region.id = 'qelly-live-region';
    region.className = 'sr-only';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    root.body.append(region);
  }
  return region;
}

export function announce(message, priority = 'polite') {
  const region = ensureLiveRegion(document);
  region.setAttribute('aria-live', priority);
  region.textContent = '';
  requestAnimationFrame(() => { region.textContent = message; });
}

export function openDialog(dialog) {
  state.lastFocused = document.activeElement;
  dialog.showModal();
  const target = dialog.querySelector('[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  target?.focus();
  dialog.addEventListener('keydown', trapFocus);
}

export function closeDialog(dialog) {
  dialog.removeEventListener('keydown', trapFocus);
  dialog.close();
  state.lastFocused?.focus?.();
}

function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget;
  const items = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && !el.hidden);
  if (!items.length) return;
  const first = items[0];
  const last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function rovingTabIndex(items, activeIndex = 0) {
  items.forEach((item, index) => item.tabIndex = index === activeIndex ? 0 : -1);
  items.forEach((item, index) => item.addEventListener('keydown', (event) => {
    if (!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === (horizontal ? 'ArrowRight' : 'ArrowDown')) next = (index + 1) % items.length;
    else next = (index - 1 + items.length) % items.length;
    items.forEach((candidate, candidateIndex) => candidate.tabIndex = candidateIndex === next ? 0 : -1);
    items[next].focus();
  }));
}
