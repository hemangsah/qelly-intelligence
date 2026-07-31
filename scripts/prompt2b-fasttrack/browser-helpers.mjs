import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

export const sha256 = body => createHash('sha256').update(body).digest('hex');
export async function startFrontendServer() {
  const dist = path.resolve('dist/frontend');
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname).replace(/^\/qelly-intelligence\/?/, '');
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const target = path.join(dist, rel);
    try {
      const body = await readFile(target);
      res.writeHead(200, { 'content-type': mime[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      try {
        const body = await readFile(path.join(dist, 'index.html'));
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/qelly-intelligence/`;
  return { server, base };
}

export const twoFrames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
export const waitForRoute = async page => {
  await page.waitForSelector('html[data-app-ready="true"]', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => {
    const main = document.querySelector('#main');
    return main && main.getAttribute('aria-busy') === 'false' && main.childElementCount > 0 && (main.textContent ?? '').trim().length > 60;
  }, null, { timeout: 30000 });
  await page.evaluate(async () => { await document.fonts?.ready; });
  await page.waitForFunction(() => !document.querySelector('.qelly-opening'), null, { timeout: 5000 });
  await twoFrames(page);
};
export const applyThemeAndMotion = async (page, theme, motion) => {
  await page.evaluate(persona => {
    const selector = document.querySelector('#global-theme-selector');
    if (!selector) throw new Error('Governed persona selector is unavailable');
    selector.value = persona;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
  }, theme.persona);
  await page.waitForFunction(persona => document.documentElement.dataset.theme === persona && document.documentElement.dataset.persona === persona, theme.persona, { timeout: 10000 });
  await page.evaluate(mode => {
    document.documentElement.dataset.motion = mode;
    if (mode === 'reduced') document.documentElement.style.setProperty('--q-motion-scale', '0');
    else document.documentElement.style.removeProperty('--q-motion-scale');
  }, motion);
  await page.evaluate(async () => { await document.fonts?.ready; });
  await twoFrames(page);
};
export const clickTrustedAction = async (page, selector, actionName) => {
  const action = page.locator(selector);
  await action.waitFor({ state: 'visible', timeout: 10000 });
  if (!await action.isEnabled()) throw new Error(`${actionName} action is disabled`);
  await action.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  await twoFrames(page);
  const box = await action.boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const hit = await page.evaluate(({ x, y, selector }) => {
    const target = document.querySelector(selector);
    const at = document.elementFromPoint(x, y);
    return {
      ok: Boolean(target && at && (at === target || target.contains(at))),
      targetTag: target?.tagName ?? null,
      hitTag: at?.tagName ?? null,
      hitClass: at?.className ?? null
    };
  }, { x, y, selector });
  if (!hit.ok) throw new Error(`Obstructed action ${selector}; hit=${hit.hitTag}.${String(hit.hitClass ?? '')}`);
  const token = `${actionName}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.evaluate(({ selector, actionName, token }) => {
    window.__qellyReviewActionCleanup?.();
    document.documentElement.removeAttribute('data-qelly-review-action');
    const handler = event => {
      const target = event.target instanceof Element ? event.target.closest(selector) : null;
      if (!target) return;
      document.documentElement.setAttribute('data-qelly-review-action', JSON.stringify({ token, actionName, isTrusted: event.isTrusted, tag: target.tagName }));
    };
    document.addEventListener('click', handler, true);
    window.__qellyReviewActionCleanup = () => document.removeEventListener('click', handler, true);
  }, { selector, actionName, token });
  await page.mouse.click(x, y, { button: 'left', clickCount: 1 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const proof = await page.evaluate(token => {
    const raw = document.documentElement.getAttribute('data-qelly-review-action');
    window.__qellyReviewActionCleanup?.();
    delete window.__qellyReviewActionCleanup;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed.token === token ? parsed : null;
    } catch {
      return null;
    }
  }, token);
  if (!proof?.isTrusted) throw new Error(`${actionName} trusted pointer proof missing`);
  return { selector, actionName, token, isTrusted: true, clickCount: 1, forced: false, hit };
};
export const performRouteAction = async (page, key) => {
  if (key === 'calculator-center') {
    const before = await page.locator('#result-primary').textContent();
    const click = await clickTrustedAction(page, '[data-action="calculate"]', 'calculator-center-calculate');
    await page.waitForFunction(value => document.querySelector('#result-primary')?.textContent !== value, before, { timeout: 10000 });
    return { click, postCondition: 'result-primary-changed' };
  }
  if (key === 'indicator-library') {
    const before = await page.locator('#indicator-primary').textContent();
    const click = await clickTrustedAction(page, '[data-action="calculate"]', 'indicator-library-calculate');
    await page.waitForFunction(value => document.querySelector('#indicator-primary')?.textContent !== value, before, { timeout: 10000 });
    return { click, postCondition: 'indicator-primary-changed' };
  }
  if (key === 'formula-detail') {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('qelly.calculations.v1') || '{"items":[]}').items.length);
    const click = await clickTrustedAction(page, '[data-action="save"]', 'formula-detail-save');
    await page.waitForFunction(value => JSON.parse(localStorage.getItem('qelly.calculations.v1') || '{"items":[]}').items.length > value, before, { timeout: 10000 });
    return { click, postCondition: 'saved-count-increased' };
  }
  if (key === 'indicator-detail') {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('qelly.calculations.v1') || '{"items":[]}').items.length);
    const click = await clickTrustedAction(page, '[data-action="save"]', 'indicator-detail-save');
    await page.waitForFunction(value => JSON.parse(localStorage.getItem('qelly.calculations.v1') || '{"items":[]}').items.length > value, before, { timeout: 10000 });
    return { click, postCondition: 'saved-count-increased' };
  }
  if (key === 'calculator-detail') {
    const before = await page.locator('#calculator-detail-primary').textContent();
    const click = await clickTrustedAction(page, '[data-action="calculate"]', 'calculator-detail-calculate');
    await page.waitForFunction(value => document.querySelector('#calculator-detail-primary')?.textContent !== value, before, { timeout: 10000 });
    return { click, postCondition: 'calculator-detail-primary-changed' };
  }
  if (key === 'saved-calculation-detail') {
    await page.locator('#saved-detail-name').fill('Prompt 2B Review Updated');
    const click = await clickTrustedAction(page, '[data-action="update"]', 'saved-detail-update');
    await page.waitForFunction(() => document.querySelector('.q-saved-detail-page')?.textContent?.includes('Version 3'), null, { timeout: 10000 });
    return { click, postCondition: 'revision-version-3' };
  }
  return { click: null, postCondition: 'not-applicable' };
};
export const measureNavigationClearance = async page => page.evaluate(async () => {
  const main = document.querySelector('#main');
  const navigation = document.querySelector('#mobile-navigation');
  if (!main || !navigation) return { supported: false, reason: 'missing-main-or-navigation', obscured: 0, clearance: null, focusClearance: null };
  const navStyle = getComputedStyle(navigation);
  if (navStyle.position !== 'fixed' || navStyle.display === 'none' || navStyle.visibility === 'hidden') {
    return { supported: false, reason: 'navigation-not-fixed-visible', obscured: 0, clearance: null, focusClearance: null };
  }
  const sentinel = document.createElement('span');
  sentinel.setAttribute('data-qelly-nav-sentinel', 'true');
  sentinel.style.cssText = 'display:block;inline-size:1px;block-size:1px;pointer-events:none;';
  main.append(sentinel);
  sentinel.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' });
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const navRectAtBottom = navigation.getBoundingClientRect();
  const sentinelRect = sentinel.getBoundingClientRect();
  const candidates = [...main.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  });
  const visibleCandidates = candidates.filter(element => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight;
  });
  const obscuredElements = visibleCandidates.filter(element => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > navRectAtBottom.top + 1 && rect.top < navRectAtBottom.bottom - 1;
  }).map(element => ({ tag: element.tagName, id: element.id || null, action: element.getAttribute('data-action'), bottom: element.getBoundingClientRect().bottom }));
  const last = candidates.at(-1) ?? null;
  let focusClearance = null;
  let focusElement = null;
  if (last) {
    last.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    last.focus();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const navRect = navigation.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    focusClearance = navRect.top - lastRect.bottom;
    focusElement = { tag: last.tagName, id: last.id || null, action: last.getAttribute('data-action'), top: lastRect.top, bottom: lastRect.bottom };
  }
  const result = {
    supported: true,
    navTop: navRectAtBottom.top,
    navBottom: navRectAtBottom.bottom,
    navHeight: navRectAtBottom.height,
    obscured: obscuredElements.length,
    obscuredElements,
    clearance: navRectAtBottom.top - sentinelRect.bottom,
    focusClearance,
    focusElement,
    sentinel: { top: sentinelRect.top, bottom: sentinelRect.bottom }
  };
  sentinel.remove();
  return result;
});
export const captureMetrics = page => page.evaluate(() => {
  const root = document.documentElement, body = document.body, main = document.querySelector('#main');
  const visible = element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return !element.disabled && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };
  const interactive = [...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(visible);
  const unlabeled = interactive.filter(element => {
    if (element.tagName === 'BUTTON' || element.tagName === 'A') return !(element.textContent ?? '').trim() && !element.getAttribute('aria-label') && !element.getAttribute('title');
    const id = element.id;
    return !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) && !element.closest('label');
  }).length;
  const contentBottom = Math.max(...[...document.querySelectorAll('#main > *, #main section, #main article')].map(element => element.getBoundingClientRect().bottom + scrollY), 0);
  const style = getComputedStyle(root);
  return {
    textLength: (main?.textContent ?? '').trim().length,
    overflowX: Math.max(0, root.scrollWidth - root.clientWidth),
    documentHeight: root.scrollHeight,
    contentBottom,
    excessTrailingSpace: Math.max(0, root.scrollHeight - contentBottom),
    fontStatus: document.fonts.status,
    theme: root.dataset.theme ?? '',
    persona: root.dataset.persona ?? '',
    motion: root.dataset.motion ?? '',
    semanticPalette: {
      canvas: style.getPropertyValue('--q-surface-canvas').trim() || style.getPropertyValue('--q-background').trim(),
      surface: style.getPropertyValue('--q-surface').trim(), text: style.getPropertyValue('--q-text').trim(), focus: style.getPropertyValue('--q-focus').trim(),
      positive: style.getPropertyValue('--q-positive').trim(), negative: style.getPropertyValue('--q-negative').trim()
    },
    bodyBackground: getComputedStyle(body).backgroundColor,
    logo: Boolean(document.querySelector('.q-brand-lockup,.q-app-brand,.q-brand-mark,img[src*="qelly"],svg[aria-label*="Qelly" i]')),
    unlabeledControls: unlabeled,
    cls: Number(window.__qellyCLS ?? 0),
    headingCount: document.querySelectorAll('h1,h2,h3').length
  };
});
export const captureTruth = (page, key) => page.evaluate(current => {
  const text = document.querySelector('#main')?.textContent ?? '';
  const rules = {
    'calculator-center': /DETERMINISTIC LOCAL/.test(text) && /not personalized investment/i.test(text),
    'india-finance': /effective/i.test(text) && /unavailable/i.test(text),
    'indicator-library': /USER-PROVIDED OHLCV/.test(text) && /No external indicator API/.test(text),
    'formula-library': /151/.test(text) && /Formula/i.test(text),
    'saved-calculations': /browser/i.test(text) && /cloud save unavailable/i.test(text),
    'formula-detail': /FRESH_REIMPLEMENTATION_2026/.test(text) && /continuity is not claimed/i.test(text),
    'indicator-detail': /FRESH_REIMPLEMENTATION_2026/.test(text) && /No order-book/i.test(text),
    'calculator-detail': /Present Value/i.test(text) && /FRESH_REIMPLEMENTATION_2026/.test(text) && /No broker, exchange or provider/i.test(text),
    'saved-calculation-detail': /DETERMINISTIC LOCAL/.test(text) && /Revision history/i.test(text)
  };
  return Boolean(rules[current]);
}, key);
export const shouldCaptureRepresentative = (width, theme, motion) =>
  (width === 1440 && motion === 'full') ||
  (width === 1024 && motion === 'full' && ['dark','porcelain-light'].includes(theme)) ||
  (width === 390 && motion === 'reduced');
export const recordFile = async (manifest, kind, file, extra = {}) => {
  const body = await readFile(file);
  const shardRoot = path.dirname(path.dirname(file));
  manifest.push({ kind, path: path.relative(shardRoot, file).replaceAll('\\', '/'), bytes: body.length, sha256: sha256(body), ...extra });
};
