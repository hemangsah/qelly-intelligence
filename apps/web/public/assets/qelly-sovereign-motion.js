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
  if (root.dataset.preview === 'static') {
    item.dataset.motionBound = 'true';
    item.classList.add('q-motion-item', 'q-pointer-card', 'is-inview');
    return;
  }
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
    const interactive = event.target instanceof Element
      ? event.target.closest('button,a,input,select,textarea,[role="button"],[role="link"],[data-action]')
      : null;
    if (interactive && item.contains(interactive)) {
      item.style.setProperty('--tilt-x', '0deg');
      item.style.setProperty('--tilt-y', '0deg');
      return;
    }
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

/* Prompt 2B final mobile visual closure.
   Presentation-only: no numerical, API, schema, migration or persistence behavior changes. */
const qellyMobileClosureCss = `
html[data-resolved-appearance="dark"] :where(.q-saved-card,.q-result-priority){
  background:linear-gradient(145deg,var(--q-panel),var(--q-raised));
  color:var(--q-text);
  border-color:var(--q-border);
}
html[data-resolved-appearance="dark"] .q-saved-card :where(h2,h3,strong,dt,dd,p,span,small){color:inherit}
html[data-resolved-appearance="dark"] .q-saved-card :where(input,select,textarea),
html[data-resolved-appearance="dark"] .q-saved-detail-page :where(input,select,textarea){
  background:var(--q-surface);
  color:var(--q-text);
  border-color:var(--q-border);
}
@media(max-width:900px){
  .q-calculator-layout,.q-calculator-body{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    width:100%!important;
    max-width:100%!important;
    gap:16px!important;
  }
  .q-calculator-layout>*,.q-calculator-body>*{
    grid-column:1!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  .q-formula-detail-page,.q-indicator-detail-page,.q-calculator-detail-page,.q-saved-detail-page{
    gap:14px!important;
    width:100%;
    min-width:0;
  }
  .q-formula-detail-page .q-panel,.q-indicator-detail-page .q-panel,
  .q-calculator-detail-page .q-panel,.q-saved-detail-page .q-panel{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  .q-context-shelf{
    display:flex!important;
    gap:8px!important;
    overflow-x:auto!important;
    overscroll-behavior-inline:contain;
    scrollbar-width:none;
    padding:8px 12px!important;
    scroll-padding-inline:12px;
  }
  .q-context-shelf::-webkit-scrollbar{display:none}
  .q-context-shelf>*{flex:0 0 auto;white-space:nowrap}
  .q-context-shelf :where(a,button){min-height:38px;border-radius:999px;padding-inline:12px}
  .q-formula-detail-page .q-evidence-grid,
  .q-indicator-detail-page .q-evidence-grid,
  .q-calculator-detail-page .q-evidence-grid,
  .q-saved-detail-page .q-evidence-grid{
    display:grid;
    grid-template-columns:minmax(0,1fr)!important;
    gap:0;
    margin-block:0 18px;
  }
  .q-formula-detail-page .q-evidence-grid>div,
  .q-indicator-detail-page .q-evidence-grid>div,
  .q-calculator-detail-page .q-evidence-grid>div,
  .q-saved-detail-page .q-evidence-grid>div{
    display:grid;
    grid-template-columns:minmax(92px,.42fr) minmax(0,1fr);
    gap:10px;
    align-items:start;
    padding:10px 0;
    border-bottom:1px solid var(--q-border);
  }
  .q-evidence-grid dt{color:var(--q-muted);font-size:11px;font-weight:700}
  .q-evidence-grid dd{margin:0;min-width:0;overflow-wrap:anywhere}
  .q-formula-detail-page pre,.q-indicator-detail-page pre,
  .q-calculator-detail-page pre,.q-saved-detail-page pre{
    max-height:260px!important;
    overflow:auto!important;
    padding:12px!important;
    font-size:11px!important;
    line-height:1.55!important;
    white-space:pre-wrap!important;
    overflow-wrap:anywhere!important;
  }
  .q-saved-detail-page .q-field{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    gap:7px!important;
    margin:0 0 14px!important;
  }
  .q-saved-detail-page .q-field>span{display:block;color:var(--q-muted);font-size:11px;font-weight:750}
  .q-saved-detail-page .q-field :where(input,textarea,select){
    width:100%!important;min-width:0!important;box-sizing:border-box!important;margin:0!important;
  }
  .q-saved-detail-page .q-field textarea{min-height:128px;resize:vertical}
  .q-saved-detail-page .q-check{display:flex!important;align-items:center;gap:10px;min-height:46px;margin:2px 0 14px}
  .q-saved-detail-page .q-check input{inline-size:20px;block-size:20px;min-height:20px}
  .q-saved-detail-page .q-actions,.q-formula-detail-page .q-actions,
  .q-indicator-detail-page .q-actions,.q-calculator-detail-page .q-actions{
    display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:8px!important;width:100%;
  }
  .q-saved-detail-page .q-actions .q-button,.q-formula-detail-page .q-actions .q-button,
  .q-indicator-detail-page .q-actions .q-button,.q-calculator-detail-page .q-actions .q-button{
    width:100%;justify-content:center;
  }
  .q-saved-detail-page .q-saved-card{padding:14px!important;gap:10px}
  .q-saved-detail-page .q-saved-card .q-button{width:100%}
}
@media(max-width:420px){
  .q-formula-detail-page .q-evidence-grid>div,.q-indicator-detail-page .q-evidence-grid>div,
  .q-calculator-detail-page .q-evidence-grid>div,.q-saved-detail-page .q-evidence-grid>div{
    grid-template-columns:minmax(0,1fr)
  }
}`;
if (!document.getElementById('qelly-prompt2b-mobile-visual-closure')) {
  const style = document.createElement('style');
  style.id = 'qelly-prompt2b-mobile-visual-closure';
  style.textContent = qellyMobileClosureCss;
  document.head.appendChild(style);
}
const removeStaticPersonaToast = () => {
  if (root.dataset.preview !== 'static') return;
  document.querySelectorAll('.q-toast').forEach((item) => {
    if (/operating mode active/i.test(item.textContent || '')) item.remove();
  });
};
new MutationObserver(removeStaticPersonaToast).observe(document.body, { childList: true, subtree: true });
removeStaticPersonaToast();
