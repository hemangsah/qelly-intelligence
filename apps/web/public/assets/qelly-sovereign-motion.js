const root = document.documentElement;
const main = document.getElementById('main');

const prefersReduced = () => root.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;

function ensureAmbientLayers() {
  if (!document.querySelector('.q-cursor-aura')) {
    const aura = document.createElement('div');
    aura.className = 'q-cursor-aura';
    aura.setAttribute('aria-hidden', 'true');
    document.body.appendChild(aura);
    window.addEventListener('pointermove', (event) => {
      if (prefersReduced()) return;
      aura.style.setProperty('--aura-x', `${event.clientX}px`);
      aura.style.setProperty('--aura-y', `${event.clientY}px`);
      aura.classList.add('is-visible');
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => aura.classList.remove('is-visible'));
  }
  if (!document.querySelector('.q-scroll-progress')) {
    const progress = document.createElement('div');
    progress.className = 'q-scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);
    const update = () => {
      const height = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      progress.style.setProperty('--scroll-progress', String(Math.min(1, scrollY / height)));
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update, { passive: true });
    update();
  }
}

function bindReveal(item, observer, index) {
  if (item.dataset.motionBound === 'true') return;
  item.dataset.motionBound = 'true';
  item.classList.add('q-motion-item', 'q-pointer-card');
  item.style.setProperty('--reveal-delay', `${Math.min(index % 9, 8) * 38}ms`);
  observer.observe(item);
  item.addEventListener('pointermove', (event) => {
    const rect = item.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    item.style.setProperty('--pointer-x', `${px}px`);
    item.style.setProperty('--pointer-y', `${py}px`);
    if (prefersReduced() || item.closest('.q-data-grid')) return;
    const rx = ((py / Math.max(rect.height, 1)) - .5) * -1.3;
    const ry = ((px / Math.max(rect.width, 1)) - .5) * 1.3;
    item.style.setProperty('--tilt-x', `${rx}deg`);
    item.style.setProperty('--tilt-y', `${ry}deg`);
  }, { passive: true });
  item.addEventListener('pointerleave', () => {
    item.style.setProperty('--tilt-x', '0deg');
    item.style.setProperty('--tilt-y', '0deg');
  }, { passive: true });
}

function bindMagnetic(button) {
  if (button.dataset.magneticBound === 'true') return;
  button.dataset.magneticBound = 'true';
  button.classList.add('q-magnetic');
  button.addEventListener('pointermove', (event) => {
    if (prefersReduced()) return;
    const rect = button.getBoundingClientRect();
    const currentX = Number.parseFloat(button.style.getPropertyValue('--magnet-x')) || 0;
    const currentY = Number.parseFloat(button.style.getPropertyValue('--magnet-y')) || 0;
    const baseCenterX = rect.left - currentX + rect.width / 2;
    const baseCenterY = rect.top - currentY + rect.height / 2;
    const x = (event.clientX - baseCenterX) * .075;
    const y = (event.clientY - baseCenterY) * .075;
    button.style.setProperty('--magnet-x', `${x}px`);
    button.style.setProperty('--magnet-y', `${y}px`);
  }, { passive: true });
  button.addEventListener('pointerleave', () => {
    button.style.setProperty('--magnet-x', '0px');
    button.style.setProperty('--magnet-y', '0px');
  }, { passive: true });
  button.addEventListener('pointerdown', (event) => {
    if (prefersReduced()) return;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'q-button-ripple';
    const size = Math.max(rect.width, rect.height) * 1.5;
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });
}

function bindMetricCounter(element) {
  if (element.dataset.counterBound === 'true' || prefersReduced()) return;
  const raw = element.textContent?.trim() || '';
  const match = raw.match(/^([₹$€£]?)(-?[\d,.]+)(.*)$/);
  if (!match) return;
  const number = Number(match[2].replaceAll(',', ''));
  if (!Number.isFinite(number) || Math.abs(number) > 1e12) return;
  element.dataset.counterBound = 'true';
  const prefix = match[1], suffix = match[3];
  const decimals = (match[2].split('.')[1] || '').length;
  const started = performance.now();
  const duration = 720;
  const run = (now) => {
    const p = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - p, 4);
    const current = number * eased;
    element.textContent = `${prefix}${current.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
    if (p < 1) requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

function activateMotion() {
  ensureAmbientLayers();
  const revealSelectors = [
    '.q-kpi', '.q-panel', '.q-category-card', '.q-venue-card', '.q-dex-card',
    '.q-provider-card', '.q-research-card', '.q-notification-card', '.q-article-shell',
    '.q-asset-hero', '.q-persona-card', '.q-universe-node', '.q-market-pulse-card',
    '.q-about-stat', '.q-live-stage', '.q-feature-card'
  ];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-inview');
        observer.unobserve(entry.target);
        entry.target.querySelectorAll('.q-kpi-value').forEach(bindMetricCounter);
      }
    });
  }, { threshold: .055, rootMargin: '70px 0px' });
  [...document.querySelectorAll(revealSelectors.join(','))].forEach((item, index) => bindReveal(item, observer, index));
  document.querySelectorAll('.q-button,.q-icon-button,.q-nav-link,.q-theme-choice,.q-choice-row').forEach(bindMagnetic);
}

let scheduled = false;
function scheduleMotion() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    activateMotion();
  });
}

if (main) new MutationObserver(scheduleMotion).observe(main, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  if (!main || prefersReduced()) return scheduleMotion();
  main.animate([
    { opacity: .18, transform: 'translate3d(0,16px,0) scale(.994)', filter: 'blur(4px)' },
    { opacity: 1, transform: 'translate3d(0,0,0) scale(1)', filter: 'blur(0)' }
  ], { duration: 610, easing: 'cubic-bezier(.22,1,.36,1)' });
  scheduleMotion();
});

const selector = document.getElementById('global-theme-selector');
if (selector) {
  const labels = {
    'burgundy-command': 'Scalper Velocity',
    'porcelain-burgundy': 'Investor Compound',
    'burgundy-night': 'Aggressive Alpha',
    'graphite-terminal': 'Quant Operator',
    'midnight-research': 'Research Oracle',
    'high-contrast': 'Signal Access'
  };
  [...selector.options].forEach((option) => { option.textContent = labels[option.value] || option.textContent; });
}

document.addEventListener('DOMContentLoaded', scheduleMotion);
scheduleMotion();
