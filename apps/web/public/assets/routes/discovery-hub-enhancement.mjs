const DISCOVERY_HASH = /^#\/discovery-hub(?:\/|$)/;
const enhancedPages = new WeakSet();
const processingPages = new WeakSet();

export function formatDiscoveryEvidenceValue(evidence) {
  const record = evidence && typeof evidence === 'object' ? evidence : { value: evidence, unit: '' };
  const raw = record.value;
  if (raw === null || raw === undefined || raw === '') return 'N/A';
  const numeric = Number(raw);
  if (record.unit === 'percent' && Number.isFinite(numeric)) {
    return `${numeric.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
  }
  if (record.unit === 'count' && Number.isFinite(numeric)) {
    return numeric.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  if (record.unit === 'score' && Number.isFinite(numeric)) {
    return numeric.toLocaleString('en-IN', { maximumFractionDigits: 1 });
  }
  return String(raw);
}

function apiUrl(path) {
  const base = String(window.__QELLY_CONFIG__?.apiBaseUrl ?? '').replace(/\/$/, '');
  return base ? new URL(path, `${base}/`).toString() : path;
}

function routeIsDiscoveryHub() {
  return DISCOVERY_HASH.test(window.location.hash);
}

function makeScrollableRegion(element, label) {
  if (!element) return;
  element.tabIndex = 0;
  element.setAttribute('role', 'region');
  element.setAttribute('aria-label', label);
  element.dataset.discoveryScrollRegion = 'true';
}

function activateProgressiveDensity(main) {
  main.dataset.discoveryHubEnhanced = 'active';
  makeScrollableRegion(
    main.querySelector('.q-discovery-card-grid'),
    'Category breadth. Scroll horizontally to inspect every category.'
  );
  makeScrollableRegion(
    main.querySelector('.q-discovery-three'),
    'Discovery evidence panels. Scroll horizontally for news, events and prediction fixtures.'
  );
  makeScrollableRegion(
    main.querySelector('.q-page > section.q-panel:last-child .q-dependency-grid'),
    'Platform trust components. Scroll horizontally to inspect every component.'
  );
}

async function correctEvidenceKpis(main) {
  const response = await fetch(apiUrl('/api/v1/discovery/overview'), {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) return false;
  const overview = await response.json();
  if (!Array.isArray(overview?.kpis)) return false;

  const cards = [...main.querySelectorAll('.q-kpi-grid .q-kpi')];
  for (const [index, item] of overview.kpis.entries()) {
    const card = cards.find((candidate) => candidate.querySelector('.q-kpi-label')?.textContent.trim() === item.label) ?? cards[index];
    const valueNode = card?.querySelector('.q-kpi-value');
    if (!valueNode) continue;
    valueNode.textContent = formatDiscoveryEvidenceValue(item.value);
    valueNode.dataset.discoveryEvidence = 'formatted';
    if (item.value && typeof item.value === 'object') {
      const evidenceLabel = [item.value.provider, item.value.freshnessClass, item.value.canonicalEntityId].filter(Boolean).join(' · ');
      if (evidenceLabel) valueNode.setAttribute('aria-label', `${item.label}: ${valueNode.textContent}. ${evidenceLabel}`);
    }
  }
  return true;
}

let resolveInitial;
let initialSettled = false;
const initialReady = new Promise((resolve) => { resolveInitial = resolve; });

function settleInitial() {
  if (initialSettled) return;
  initialSettled = true;
  resolveInitial();
}

async function enhanceCurrentRoute() {
  const main = document.getElementById('main');
  if (!main) {
    settleInitial();
    return;
  }
  if (!routeIsDiscoveryHub()) {
    delete main.dataset.discoveryHubEnhanced;
    settleInitial();
    return;
  }
  if (main.getAttribute('aria-busy') === 'true') return;
  const page = main.querySelector(':scope > .q-page');
  if (!page || !main.querySelector('.q-discovery-card-grid')) return;
  if (enhancedPages.has(page) || processingPages.has(page)) {
    if (enhancedPages.has(page)) settleInitial();
    return;
  }

  processingPages.add(page);
  activateProgressiveDensity(main);
  try {
    await correctEvidenceKpis(main);
  } catch {
    // The application has already handled the primary route request. Keep the rendered route usable
    // if this non-destructive presentation correction cannot repeat the same read-only GET.
  } finally {
    processingPages.delete(page);
    enhancedPages.add(page);
    settleInitial();
  }
}

function scheduleEnhancement() {
  queueMicrotask(() => { void enhanceCurrentRoute(); });
}

export function installDiscoveryHubEnhancement() {
  const main = document.getElementById('main');
  if (!main) {
    settleInitial();
    return;
  }
  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(main, { attributes: true, childList: true, subtree: false, attributeFilter: ['aria-busy'] });
  window.addEventListener('hashchange', scheduleEnhancement);
  scheduleEnhancement();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.__qellyDiscoveryEnhancementReady = initialReady;
  installDiscoveryHubEnhancement();
}
