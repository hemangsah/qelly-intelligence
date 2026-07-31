import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import {
  appendFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium, firefox, webkit } from 'playwright';

const REPOSITORY = 'hemangsah/qelly-intelligence';
const WORKFLOW_PATH = '.github/workflows/prompt2b-fasttrack-gate.yml';
const HARNESS_PATH = 'scripts/prompt2b-fasttrack.mjs';
const BROWSERS = { chromium, firefox, webkit };
const VIEWPORTS = [
  [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768],
  [1280, 800], [1440, 1000], [1728, 1080], [1920, 1080],
];
const THEMES = [
  { label: 'dark', persona: 'burgundy-command', colorScheme: 'dark' },
  { label: 'porcelain-light', persona: 'porcelain-burgundy', colorScheme: 'light' },
  { label: 'oled', persona: 'burgundy-night', colorScheme: 'dark' },
  { label: 'high-contrast', persona: 'high-contrast', colorScheme: 'dark' },
];
const MOTIONS = ['full', 'reduced'];
const ROUTES = [
  { key: 'calculator-center', hash: 'calculator-center' },
  { key: 'india-finance', hash: 'india-finance' },
  { key: 'formula-library', hash: 'formula-library' },
  { key: 'formula-detail', hash: 'formula-detail/fresh-present-value' },
  { key: 'indicator-library', hash: 'indicator-library' },
  { key: 'indicator-detail', hash: 'indicator-detail/fresh-price-momentum' },
  { key: 'calculator-detail', hash: 'calculator-detail/fresh-present-value' },
  { key: 'saved-calculations', hash: 'saved-calculations' },
  { key: 'saved-calculation-detail', hash: 'saved-calculation-detail/prompt2b-review-saved' },
];
const EXPECTED_BROWSER_CASES = 1944;
const EXPECTED_BROWSER_SHARDS = 27;
const EXPECTED_CASES_PER_SHARD = 72;
const EXPECTED_A11Y_SHARDS = 9;
const EXPECTED_A11Y_CHECKS = 54;

const savedSeed = {
  schemaVersion: 2,
  items: [{
    id: 'prompt2b-review-saved',
    name: 'Prompt 2B Review Present Value',
    savedAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:05:00.000Z',
    schemaVersion: 2,
    version: 2,
    formulaVersion: '2.0.0',
    indicatorVersion: null,
    indiaRuleVersion: null,
    effectiveDate: '2026-07-30',
    result: {
      status: 'success',
      formulaId: 'fresh-present-value',
      formulaVersion: '2.0.0',
      engineVersion: '2.0.0',
      truthState: 'FRESH_REIMPLEMENTATION_2026',
      effectiveDate: '2026-07-30',
      outputs: { value: 100 },
      evidence: { provenanceStatus: 'FRESH_REIMPLEMENTATION_2026' },
    },
    notes: 'Exact fast-track browser review seed',
    tags: ['prompt2b', 'fasttrack'],
    favorite: true,
    truthState: 'DETERMINISTIC LOCAL',
    revisions: [
      {
        revisionId: 'prompt2b-r1', version: 1, createdAt: '2026-07-30T00:00:00.000Z', restoredFrom: null,
        name: 'Prompt 2B Review Present Value', result: { status: 'success', formulaId: 'fresh-present-value', formulaVersion: '2.0.0', outputs: { value: 100 }, truthState: 'FRESH_REIMPLEMENTATION_2026' },
        notes: 'Baseline', tags: ['prompt2b'], favorite: false, formulaVersion: '2.0.0', indicatorVersion: null, indiaRuleVersion: null, effectiveDate: '2026-07-30',
      },
      {
        revisionId: 'prompt2b-r2', version: 2, createdAt: '2026-07-30T00:05:00.000Z', restoredFrom: null,
        name: 'Prompt 2B Review Present Value', result: { status: 'success', formulaId: 'fresh-present-value', formulaVersion: '2.0.0', outputs: { value: 100 }, truthState: 'FRESH_REIMPLEMENTATION_2026' },
        notes: 'Exact fast-track browser review seed', tags: ['prompt2b', 'fasttrack'], favorite: true, formulaVersion: '2.0.0', indicatorVersion: null, indiaRuleVersion: null, effectiveDate: '2026-07-30',
      },
    ],
  }],
};

const sha256 = body => createHash('sha256').update(body).digest('hex');
const now = () => new Date().toISOString();
const sanitize = value => String(value).replace(/[^a-zA-Z0-9._-]+/g, '-');
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

async function appendJsonlAndFlush(handle, value) {
  await handle.write(`${JSON.stringify(value)}\n`);
  await handle.sync();
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function exactIdentity() {
  const exactHead = process.env.QELLY_REVIEW_HEAD ?? process.env.GITHUB_SHA ?? git('rev-parse', 'HEAD');
  const checkedOut = git('rev-parse', 'HEAD');
  if (checkedOut !== exactHead) throw new Error(`STALE_HEAD:${checkedOut}:${exactHead}`);
  return {
    schemaVersion: 1,
    repository: REPOSITORY,
    exactHead,
    checkedOut,
    workflowBlob: git('hash-object', WORKFLOW_PATH),
    harnessBlob: git('hash-object', HARNESS_PATH),
    runIdentity: `${process.env.GITHUB_RUN_ID ?? 'local'}:${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`,
  };
}

async function walk(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full));
    else output.push(full);
  }
  return output;
}

async function writeShaSums(root, target = 'SHARD_SHA256SUMS.txt') {
  const lines = [];
  for (const file of (await walk(root)).sort()) {
    if (path.basename(file) === target) continue;
    const body = await readFile(file);
    lines.push(`${sha256(body)}  ${path.relative(root, file).replaceAll('\\', '/')}`);
  }
  await writeFile(path.join(root, target), `${lines.join('\n')}\n`);
  return lines.length;
}

async function verifyShaSums(root, target = 'SHARD_SHA256SUMS.txt') {
  const file = path.join(root, target);
  const lines = (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean);
  const missing = [];
  const mismatches = [];
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) { mismatches.push({ line, reason: 'invalid-format' }); continue; }
    const targetPath = path.join(root, match[2]);
    try {
      const body = await readFile(targetPath);
      if (sha256(body) !== match[1]) mismatches.push({ path: match[2], reason: 'sha256' });
    } catch { missing.push(match[2]); }
  }
  return { checksumCount: lines.length, missing, mismatches };
}

function normalizeAssertion(reasons, details = '') {
  const raw = [...reasons].sort().join('|') || details || 'passed';
  return raw
    .replace(/\b\d+(?:\.\d+)?ms\b/gi, '<ms>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyFailure(reasons, actionErrors = []) {
  if (!reasons.length) return null;
  if (reasons.some(item => item.startsWith('action-errors'))) {
    if (actionErrors.some(item => /Obstructed action/.test(item.message))) return 'HIT_TESTING';
    if (actionErrors.some(item => /trusted pointer/i.test(item.message))) return 'TRUSTED_ACTION';
    return 'ACTION_STATE';
  }
  if (reasons.includes('fixed-nav-clearance')) return 'NAVIGATION';
  if (reasons.some(item => item.startsWith('horizontal-overflow'))) return 'OVERFLOW';
  if (reasons.some(item => item.startsWith('blank-tail'))) return 'LAYOUT';
  if (reasons.some(item => item.startsWith('truth-boundary'))) return 'TRUTH_ASSERTION';
  if (reasons.some(item => item.startsWith('unlabeled-controls'))) return 'ACCESSIBILITY';
  if (reasons.some(item => item.startsWith('font'))) return 'FONT';
  if (reasons.some(item => item.startsWith('cls') || item.startsWith('route-load-ms'))) return 'PERFORMANCE';
  if (reasons.some(item => item.startsWith('console-errors') || item.startsWith('page-errors') || item.startsWith('failed-local-resources'))) return 'BROWSER_RUNTIME';
  return 'ASSERTION';
}

function shouldCapturePassing(browser, width, appearance, motion, route) {
  return browser === 'chromium' && (
    (width === 1440 && motion === 'full') ||
    (width === 1024 && motion === 'full' && ['dark', 'porcelain-light'].includes(appearance)) ||
    (width === 390 && motion === 'reduced')
  ) || route === 'calculator-detail' && width === 1440 && appearance === 'dark' && motion === 'reduced' && ['firefox', 'webkit'].includes(browser);
}

async function serveFrontend() {
  const dist = path.resolve('dist/frontend');
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    let relative = decodeURIComponent(url.pathname).replace(/^\/qelly-intelligence\/?/, '');
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const target = path.join(dist, relative);
    try {
      const body = await readFile(target);
      response.writeHead(200, { 'content-type': mime[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch {
      try {
        const body = await readFile(path.join(dist, 'index.html'));
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end('not found');
      }
    }
  });
  await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));
  return { server, base: 'http://127.0.0.1:4174/qelly-intelligence/' };
}

async function waitForRoute(page) {
  await page.waitForSelector('html[data-app-ready="true"]', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => {
    const main = document.querySelector('#main');
    return main && main.getAttribute('aria-busy') === 'false' && main.childElementCount > 0 && (main.textContent ?? '').trim().length > 60;
  }, null, { timeout: 30000 });
  await page.evaluate(async () => { await document.fonts?.ready; });
  await page.waitForFunction(() => !document.querySelector('.qelly-opening'), null, { timeout: 5000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function applyThemeAndMotion(page, theme, motion) {
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
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function clickTrustedAction(page, selector, actionName) {
  const action = page.locator(selector).first();
  await action.waitFor({ state: 'visible', timeout: 10000 });
  if (!await action.isEnabled()) throw new Error(`${actionName} action is disabled`);
  await action.scrollIntoViewIfNeeded();
  const token = `${actionName}:${Date.now()}:${Math.random()}`;
  await page.evaluate(({ selector: targetSelector, actionName: targetAction, token: targetToken }) => {
    sessionStorage.removeItem('__qellyReviewTrustedAction');
    const handler = event => {
      const target = event.target instanceof Element ? event.target.closest(targetSelector) : null;
      if (!target) return;
      const prior = JSON.parse(sessionStorage.getItem('__qellyReviewTrustedAction') || '{"count":0}');
      sessionStorage.setItem('__qellyReviewTrustedAction', JSON.stringify({ token: targetToken, actionName: targetAction, count: prior.count + 1, isTrusted: event.isTrusted }));
      document.removeEventListener('click', handler, true);
    };
    document.addEventListener('click', handler, true);
  }, { selector, actionName, token });
  const box = await action.boundingBox();
  if (!box) throw new Error(`No box for ${selector}`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hit = await page.evaluate(({ x, y, selector: targetSelector }) => {
    const target = document.querySelector(targetSelector);
    const at = document.elementFromPoint(x, y);
    return Boolean(target && at && (at === target || target.contains(at)));
  }, { ...point, selector });
  if (!hit) throw new Error(`Obstructed action ${selector}`);
  await page.mouse.click(point.x, point.y, { button: 'left', clickCount: 1 });
  const evidence = await page.evaluate(targetToken => {
    const value = JSON.parse(sessionStorage.getItem('__qellyReviewTrustedAction') || 'null');
    return value?.token === targetToken ? value : null;
  }, token);
  if (!evidence || evidence.isTrusted !== true || evidence.count !== 1) throw new Error(`Trusted pointer evidence mismatch for ${actionName}`);
  return evidence.count;
}

async function performRouteAction(page, key) {
  if (key === 'calculator-center') {
    const before = await page.locator('#result-primary').textContent();
    const trustedPointerCount = await clickTrustedAction(page, '[data-action="calculate"]', 'calculator-center-calculate');
    await page.waitForFunction(value => document.querySelector('#result-primary')?.textContent !== value, before, { timeout: 10000 });
    return { action: 'calculator-center-calculate', state: 'calculated', trustedPointerCount };
  }
  if (key === 'indicator-library') {
    const before = await page.locator('#indicator-primary').textContent();
    const trustedPointerCount = await clickTrustedAction(page, '[data-action="calculate"]', 'indicator-library-calculate');
    await page.waitForFunction(value => document.querySelector('#indicator-primary')?.textContent !== value, before, { timeout: 10000 });
    return { action: 'indicator-library-calculate', state: 'calculated', trustedPointerCount };
  }
  if (key === 'formula-detail' || key === 'indicator-detail') {
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('qelly.calculations.v1') || '{"items":[]}').items.length);
    const trustedPointerCount = await clickTrustedAction(page, '[data-action="save"]', `${key}-save`);
    await page.waitForFunction(value => JSON.parse(localStorage.getItem('qelly.calculations.v1') || '{"items":[]}').items.length > value, before, { timeout: 10000 });
    return { action: `${key}-save`, state: 'saved', trustedPointerCount };
  }
  if (key === 'calculator-detail') {
    const before = await page.locator('#calculator-detail-primary').textContent();
    const trustedPointerCount = await clickTrustedAction(page, '[data-action="calculate"]', 'calculator-detail-calculate');
    await page.waitForFunction(value => document.querySelector('#calculator-detail-primary')?.textContent !== value, before, { timeout: 10000 });
    return { action: 'calculator-detail-calculate', state: 'calculated', trustedPointerCount };
  }
  if (key === 'saved-calculation-detail') {
    await page.locator('#saved-detail-name').fill('Prompt 2B Review Updated');
    const trustedPointerCount = await clickTrustedAction(page, '[data-action="update"]', 'saved-detail-update');
    await page.waitForFunction(() => document.querySelector('.q-saved-detail-page')?.textContent?.includes('Version 3'), null, { timeout: 10000 });
    return { action: 'saved-detail-update', state: 'updated-version-3', trustedPointerCount };
  }
  return { action: 'none', state: 'route-reviewed', trustedPointerCount: 0 };
}

async function measureNavigationClearance(page) {
  return page.evaluate(async () => {
    const main = document.querySelector('#main');
    const navigation = document.querySelector('#mobile-navigation');
    if (!main || !navigation || getComputedStyle(navigation).position !== 'fixed' || getComputedStyle(navigation).display === 'none') {
      return { supported: false, obscured: 0, clearance: null, focusClearance: null, scroller: null };
    }
    const isScrollable = element => {
      const style = getComputedStyle(element);
      return /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    };
    const candidates = [];
    for (let current = main; current; current = current.parentElement) if (isScrollable(current)) candidates.push(current);
    const documentScroller = document.scrollingElement || document.documentElement;
    if (documentScroller.scrollHeight > documentScroller.clientHeight + 1) candidates.push(documentScroller);
    const scroller = candidates[0] || documentScroller;
    const sentinel = document.createElement('div');
    sentinel.dataset.qellyReviewSentinel = 'true';
    sentinel.tabIndex = -1;
    sentinel.style.cssText = 'display:block;inline-size:1px;block-size:1px;opacity:.001;pointer-events:none;';
    main.append(sentinel);
    scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const navRect = navigation.getBoundingClientRect();
    const sentinelRect = sentinel.getBoundingClientRect();
    const interactive = [...main.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')]
      .filter(element => !navigation.contains(element) && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden');
    const visible = interactive.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
    });
    const obscured = visible.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > navRect.top + 1 && rect.top < navRect.bottom - 1 && rect.right > navRect.left && rect.left < navRect.right;
    }).length;
    const last = interactive.at(-1);
    if (last) {
      last.focus();
      last.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    const lastRect = last?.getBoundingClientRect?.();
    const result = {
      supported: true,
      obscured,
      clearance: navRect.top - sentinelRect.bottom,
      focusClearance: lastRect && lastRect.bottom > 0 && lastRect.top < innerHeight ? navRect.top - lastRect.bottom : null,
      scroller: scroller === documentScroller ? 'document' : `${scroller.tagName.toLowerCase()}${scroller.id ? `#${scroller.id}` : ''}${scroller.className ? `.${String(scroller.className).trim().replace(/\s+/g, '.')}` : ''}`,
    };
    sentinel.remove();
    return result;
  });
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const main = document.querySelector('#main');
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
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
        surface: style.getPropertyValue('--q-surface').trim(),
        text: style.getPropertyValue('--q-text').trim(),
        focus: style.getPropertyValue('--q-focus').trim(),
        positive: style.getPropertyValue('--q-positive').trim(),
        negative: style.getPropertyValue('--q-negative').trim(),
      },
      bodyBackground: getComputedStyle(body).backgroundColor,
      logo: Boolean(document.querySelector('.q-brand-lockup,.q-app-brand,.q-brand-mark,img[src*="qelly"],svg[aria-label*="Qelly" i]')),
      unlabeledControls: unlabeled,
      cls: Number(window.__qellyCLS ?? 0),
      headingCount: document.querySelectorAll('h1,h2,h3').length,
    };
  });
}

async function collectTruth(page, route) {
  return page.evaluate(current => {
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
      'saved-calculation-detail': /DETERMINISTIC LOCAL/.test(text) && /Revision history/i.test(text),
    };
    return Boolean(rules[current]);
  }, route);
}

function buildReasons({ metrics, navClearance, truth, consoleErrors, pageErrors, requiredResourceFailures, actionErrors, loadMs, height }) {
  const reasons = [];
  if (metrics.textLength < 60) reasons.push('empty-content');
  if (metrics.overflowX > 1) reasons.push(`horizontal-overflow:${metrics.overflowX}`);
  if (metrics.fontStatus !== 'loaded') reasons.push(`font:${metrics.fontStatus}`);
  if (!metrics.logo) reasons.push('logo-missing');
  if (metrics.unlabeledControls > 0) reasons.push(`unlabeled-controls:${metrics.unlabeledControls}`);
  if (navClearance.supported && (navClearance.obscured > 0 || navClearance.clearance < -1 || (navClearance.focusClearance !== null && navClearance.focusClearance < -1))) reasons.push('fixed-nav-clearance');
  if (metrics.cls > 0.1) reasons.push(`cls:${metrics.cls}`);
  if (metrics.excessTrailingSpace > height) reasons.push(`blank-tail:${metrics.excessTrailingSpace}`);
  if (loadMs > 15000) reasons.push(`route-load-ms:${loadMs.toFixed(1)}`);
  if (!truth) reasons.push('truth-boundary');
  if (consoleErrors.length) reasons.push(`console-errors:${consoleErrors.length}`);
  if (pageErrors.length) reasons.push(`page-errors:${pageErrors.length}`);
  if (requiredResourceFailures.length) reasons.push(`failed-local-resources:${requiredResourceFailures.length}`);
  if (actionErrors.length) reasons.push(`action-errors:${actionErrors.length}`);
  return reasons;
}

async function browserShard() {
  const identity = exactIdentity();
  const browserName = process.env.QELLY_BROWSER;
  const routeKey = process.env.QELLY_ROUTE_KEY;
  const route = ROUTES.find(item => item.key === routeKey);
  if (!BROWSERS[browserName]) throw new Error(`Unknown browser shard: ${browserName}`);
  if (!route) throw new Error(`Unknown route shard: ${routeKey}`);
  const shardId = process.env.QELLY_SHARD_ID ?? `${browserName}-${routeKey}`;
  const output = path.resolve(process.env.QELLY_SHARD_OUTPUT ?? `.prompt2b-fasttrack/browser/${shardId}`);
  const screenshots = path.join(output, 'screenshots');
  const traces = path.join(output, 'traces');
  await mkdir(screenshots, { recursive: true });
  await mkdir(traces, { recursive: true });
  const resultsPath = path.join(output, 'SHARD_RESULTS.jsonl');
  await writeFile(resultsPath, '');
  const resultsHandle = await open(resultsPath, 'a');
  const records = [];
  const signatureCounts = new Map();
  const tracedSignatures = new Set();
  await atomicJson(path.join(output, 'SHARD_IDENTITY.json'), {
    ...identity, shardId, browser: browserName, route: routeKey, expectedCases: EXPECTED_CASES_PER_SHARD,
    deterministicFixtureSeed: sha256(Buffer.from(JSON.stringify(savedSeed))), generatedAt: now(),
  });
  const { server, base } = await serveFrontend();
  const browser = await BROWSERS[browserName].launch({ headless: true });
  let sequence = 0;
  try {
    for (const [width, height] of VIEWPORTS) {
      for (const theme of THEMES) {
        for (const motion of MOTIONS) {
          sequence += 1;
          const caseId = `${browserName}::${routeKey}::${width}x${height}::${theme.label}::${motion}`;
          const startTime = now();
          const started = performance.now();
          const context = await browser.newContext({
            viewport: { width, height },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
            colorScheme: theme.colorScheme,
            acceptDownloads: true,
          });
          await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
          await context.addInitScript(seed => {
            sessionStorage.setItem('qelly.brand.opening.v1', 'seen');
            localStorage.setItem('qelly.calculations.v1', JSON.stringify(seed));
            window.__qellyCLS = 0;
            if ('PerformanceObserver' in window) {
              try {
                new PerformanceObserver(list => {
                  for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__qellyCLS += entry.value;
                }).observe({ type: 'layout-shift', buffered: true });
              } catch {}
            }
          }, savedSeed);
          const page = await context.newPage();
          const consoleErrors = [];
          const pageErrors = [];
          const requiredResourceFailures = [];
          const actionErrors = [];
          page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
          page.on('pageerror', error => pageErrors.push(error.message));
          page.on('requestfailed', request => {
            if (request.url().startsWith('http://127.0.0.1')) requiredResourceFailures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' });
          });
          let metrics = {
            textLength: 0, overflowX: 0, documentHeight: 0, contentBottom: 0, excessTrailingSpace: 0,
            fontStatus: 'unknown', theme: '', persona: '', motion: '', semanticPalette: {}, bodyBackground: '',
            logo: false, unlabeledControls: 0, cls: 0, headingCount: 0,
          };
          let navClearance = { supported: false, obscured: 0, clearance: null, focusClearance: null, scroller: null };
          let truth = false;
          let action = 'none';
          let state = 'not-started';
          let trustedPointerCount = 0;
          let sourceLine = null;
          try {
            await page.goto(`${base}#/${route.hash}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await waitForRoute(page);
            await applyThemeAndMotion(page, theme, motion);
            const actionResult = await performRouteAction(page, routeKey);
            action = actionResult.action;
            state = actionResult.state;
            trustedPointerCount = actionResult.trustedPointerCount;
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            navClearance = await measureNavigationClearance(page);
            metrics = await collectMetrics(page);
            truth = await collectTruth(page, routeKey);
          } catch (error) {
            actionErrors.push({ name: error.name ?? 'Error', message: error.message ?? String(error), stack: error.stack ?? null });
            const match = String(error.stack ?? '').match(/prompt2b-fasttrack\.mjs:(\d+):/);
            sourceLine = match ? Number(match[1]) : null;
            state = state === 'not-started' ? 'case-exception' : state;
          }
          const loadMs = performance.now() - started;
          if (metrics.theme !== theme.persona || metrics.persona !== theme.persona) {
            actionErrors.push({ name: 'ThemeIdentityError', message: `theme-not-applied:${metrics.theme}/${metrics.persona}` });
          }
          if (metrics.motion !== motion) actionErrors.push({ name: 'MotionIdentityError', message: `motion-not-applied:${metrics.motion}` });
          const reasons = buildReasons({ metrics, navClearance, truth, consoleErrors, pageErrors, requiredResourceFailures, actionErrors, loadMs, height });
          const rawAssertion = JSON.stringify({ reasons, actionErrors, consoleErrors, pageErrors, requiredResourceFailures, navClearance });
          const normalizedSignature = normalizeAssertion(reasons, rawAssertion);
          const failureClass = classifyFailure(reasons, actionErrors);
          const signatureKey = reasons.length ? normalizedSignature : null;
          if (signatureKey) signatureCounts.set(signatureKey, (signatureCounts.get(signatureKey) ?? 0) + 1);
          let screenshotPath = null;
          let screenshotSha256 = null;
          if (reasons.length || shouldCapturePassing(browserName, width, theme.label, motion, routeKey)) {
            const name = `${sanitize(caseId)}.png`;
            const absolute = path.join(screenshots, name);
            await page.screenshot({ path: absolute, fullPage: false });
            const body = await readFile(absolute);
            screenshotPath = path.relative(output, absolute).replaceAll('\\', '/');
            screenshotSha256 = sha256(body);
          }
          let tracePath = null;
          let traceSha256 = null;
          if (signatureKey && !tracedSignatures.has(signatureKey)) {
            tracedSignatures.add(signatureKey);
            const name = `${sanitize(caseId)}.zip`;
            const absolute = path.join(traces, name);
            await context.tracing.stop({ path: absolute });
            const body = await readFile(absolute);
            tracePath = path.relative(output, absolute).replaceAll('\\', '/');
            traceSha256 = sha256(body);
          } else {
            await context.tracing.stop();
          }
          const endTime = now();
          const record = {
            schemaVersion: 1,
            runIdentity: identity.runIdentity,
            exactHead: identity.exactHead,
            workflowBlob: identity.workflowBlob,
            harnessBlob: identity.harnessBlob,
            shardId,
            caseId,
            caseSequence: sequence,
            browser: browserName,
            viewport: `${width}x${height}`,
            appearance: theme.label,
            motion,
            route: routeKey,
            action,
            state,
            fixtureId: 'prompt2b-fasttrack-saved-seed-v1',
            startTime,
            endTime,
            durationMs: Number(loadMs.toFixed(3)),
            passed: reasons.length === 0,
            skipped: false,
            failureClass,
            rawAssertion,
            normalizedSignature: reasons.length ? normalizedSignature : null,
            sourceFile: HARNESS_PATH,
            sourceLine,
            consoleErrors,
            pageErrors,
            requiredResourceFailures,
            actionErrors,
            horizontalOverflow: metrics.overflowX,
            fixedNavigationOverlap: navClearance,
            blankTailFailure: metrics.excessTrailingSpace > height,
            fontFailure: metrics.fontStatus !== 'loaded',
            truthLabelFailure: !truth,
            unlabelledControlFailure: metrics.unlabeledControls,
            clsFailure: metrics.cls > 0.1,
            themeFailure: metrics.theme !== theme.persona || metrics.persona !== theme.persona,
            performanceFailure: loadMs > 15000,
            trustedPointerCount,
            retryCount: 0,
            forcedClickCount: 0,
            screenshotPath,
            screenshotSha256,
            tracePath,
            traceSha256,
            metrics,
          };
          records.push(record);
          await appendJsonlAndFlush(resultsHandle, record);
          await atomicJson(path.join(output, 'SHARD_PROGRESS.json'), {
            schemaVersion: 1, ...identity, shardId, expected: EXPECTED_CASES_PER_SHARD,
            completed: records.length, passed: records.filter(item => item.passed).length,
            failed: records.filter(item => !item.passed).length, lastCaseId: caseId, updatedAt: now(),
          });
          await page.close();
          await context.close();
        }
      }
    }
  } finally {
    await resultsHandle.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  const failures = records.filter(item => !item.passed);
  await atomicJson(path.join(output, 'SHARD_FAILURE_SIGNATURES.json'), {
    schemaVersion: 1, ...identity, shardId,
    signatures: [...signatureCounts.entries()].sort((a, b) => b[1] - a[1]).map(([signature, count]) => ({ signature, count })),
  });
  await atomicJson(path.join(output, 'SHARD_SUMMARY.json'), {
    schemaVersion: 1, ...identity, shardId, browser: browserName, route: routeKey,
    expected: EXPECTED_CASES_PER_SHARD, records: records.length,
    passed: records.length - failures.length, failed: failures.length,
    uniqueSignatures: signatureCounts.size, retries: 0, forcedClicks: 0,
  });
  await writeShaSums(output);
  console.log(JSON.stringify({ shardId, expected: EXPECTED_CASES_PER_SHARD, records: records.length, passed: records.length - failures.length, failed: failures.length, signatures: signatureCounts.size }, null, 2));
  if (records.length !== EXPECTED_CASES_PER_SHARD || failures.length) process.exitCode = 1;
}

function expectedBrowserCaseIds() {
  const values = [];
  for (const browser of Object.keys(BROWSERS)) for (const route of ROUTES) for (const [width, height] of VIEWPORTS) for (const theme of THEMES) for (const motion of MOTIONS) {
    values.push(`${browser}::${route.key}::${width}x${height}::${theme.label}::${motion}`);
  }
  return values;
}

async function findNamedFiles(root, name) {
  return (await walk(root)).filter(file => path.basename(file) === name).sort();
}

async function aggregateBrowser() {
  const head = process.env.QELLY_REVIEW_HEAD ?? process.env.GITHUB_SHA ?? git('rev-parse', 'HEAD');
  if (git('rev-parse', 'HEAD') !== head) throw new Error('STALE_HEAD_AGGREGATOR');
  const mode = process.env.QELLY_FASTTRACK_MODE ?? 'diagnostic';
  const source = path.resolve(process.env.QELLY_BROWSER_ARTIFACT_ROOT ?? '.prompt2b-fasttrack/downloaded-browser');
  const output = path.resolve('.prompt2b-review');
  await mkdir(output, { recursive: true });
  const resultFiles = await findNamedFiles(source, 'SHARD_RESULTS.jsonl');
  const identities = [];
  const checksumEvidence = [];
  const records = [];
  for (const file of resultFiles) {
    const shardRoot = path.dirname(file);
    identities.push(JSON.parse(await readFile(path.join(shardRoot, 'SHARD_IDENTITY.json'), 'utf8')));
    checksumEvidence.push({ shardRoot: path.relative(source, shardRoot), ...await verifyShaSums(shardRoot) });
    for (const line of (await readFile(file, 'utf8')).split('\n').filter(Boolean)) records.push(JSON.parse(line));
  }
  const shardIds = identities.map(item => item.shardId);
  const duplicateShardIds = shardIds.filter((item, index) => shardIds.indexOf(item) !== index);
  const shardCounts = Object.fromEntries([...new Set(shardIds)].sort().map(shardId => [shardId, records.filter(item => item.shardId === shardId).length]));
  const ids = records.map(item => item.caseId);
  const duplicateCaseIds = [...new Set(ids.filter((item, index) => ids.indexOf(item) !== index))].sort();
  const expectedIds = expectedBrowserCaseIds();
  const missingCaseIds = expectedIds.filter(item => !ids.includes(item));
  const unexpectedCaseIds = [...new Set(ids.filter(item => !expectedIds.includes(item)))].sort();
  const conflictingRecords = duplicateCaseIds.filter(caseId => new Set(records.filter(item => item.caseId === caseId).map(item => JSON.stringify(item))).size > 1);
  const identitySets = {
    exactHeads: [...new Set(identities.map(item => item.exactHead))],
    workflowBlobs: [...new Set(identities.map(item => item.workflowBlob))],
    harnessBlobs: [...new Set(identities.map(item => item.harnessBlob))],
  };
  const failures = records.filter(item => !item.passed || item.skipped);
  const signatures = new Map();
  for (const item of failures) {
    const signature = item.normalizedSignature ?? 'MISSING_SIGNATURE';
    const current = signatures.get(signature) ?? { signature, count: 0, failureClasses: {}, browsers: {}, routes: {}, viewports: {}, appearances: {}, motions: {}, actions: {}, firstCase: item.caseId, lastCase: item.caseId };
    current.count += 1;
    current.failureClasses[item.failureClass ?? 'UNKNOWN'] = (current.failureClasses[item.failureClass ?? 'UNKNOWN'] ?? 0) + 1;
    for (const [group, value] of [['browsers', item.browser], ['routes', item.route], ['viewports', item.viewport], ['appearances', item.appearance], ['motions', item.motion], ['actions', item.action]]) current[group][value] = (current[group][value] ?? 0) + 1;
    current.lastCase = item.caseId;
    signatures.set(signature, current);
  }
  const dimensions = {};
  for (const field of ['browser', 'route', 'viewport', 'appearance', 'motion', 'action', 'failureClass']) {
    dimensions[field] = {};
    for (const item of records) {
      const key = item[field] ?? 'NONE';
      dimensions[field][key] ??= { total: 0, passed: 0, failed: 0, skipped: 0 };
      dimensions[field][key].total += 1;
      if (item.skipped) dimensions[field][key].skipped += 1;
      else if (item.passed) dimensions[field][key].passed += 1;
      else dimensions[field][key].failed += 1;
    }
  }
  const integrity = {
    expectedShards: EXPECTED_BROWSER_SHARDS,
    observedShards: identities.length,
    uniqueShardIds: new Set(shardIds).size,
    duplicateShardIds,
    invalidShardCounts: Object.entries(shardCounts).filter(([, count]) => count !== EXPECTED_CASES_PER_SHARD),
    expectedCases: EXPECTED_BROWSER_CASES,
    observedRecords: records.length,
    uniqueCaseIds: new Set(ids).size,
    missingCaseIds: missingCaseIds.length,
    unexpectedCaseIds: unexpectedCaseIds.length,
    duplicateCaseIds: duplicateCaseIds.length,
    conflictingRecords: conflictingRecords.length,
    checksumMissing: checksumEvidence.flatMap(item => item.missing).length,
    checksumMismatches: checksumEvidence.flatMap(item => item.mismatches).length,
    identitySets,
    exactHeadMatch: identitySets.exactHeads.length === 1 && identitySets.exactHeads[0] === head,
    workflowIdentityMatch: identitySets.workflowBlobs.length === 1,
    harnessIdentityMatch: identitySets.harnessBlobs.length === 1,
  };
  const counter = {
    schemaVersion: 1, head, mode, generatedAt: now(),
    global: { expected: EXPECTED_BROWSER_CASES, records: records.length, passed: records.filter(item => item.passed && !item.skipped).length, failed: records.filter(item => !item.passed && !item.skipped).length, skipped: records.filter(item => item.skipped).length },
    dimensions,
    integrity,
  };
  await writeFile(path.join(output, 'CASE_RESULTS.jsonl'), `${records.map(item => JSON.stringify(item)).join('\n')}\n`);
  const indexHeader = ['caseId', 'shardId', 'browser', 'route', 'viewport', 'appearance', 'motion', 'action', 'passed', 'skipped', 'failureClass', 'normalizedSignature', 'durationMs', 'screenshotPath', 'tracePath'];
  await writeFile(path.join(output, 'CASE_INDEX.csv'), `${indexHeader.map(csv).join(',')}\n${records.map(item => indexHeader.map(field => csv(item[field])).join(',')).join('\n')}\n`);
  const failureHeader = ['caseId', 'shardId', 'browser', 'route', 'viewport', 'appearance', 'motion', 'action', 'failureClass', 'normalizedSignature', 'rawAssertion', 'sourceFile', 'sourceLine', 'screenshotPath', 'tracePath'];
  await writeFile(path.join(output, 'FAILURE_LEDGER.csv'), `${failureHeader.map(csv).join(',')}\n${failures.map(item => failureHeader.map(field => csv(item[field])).join(',')).join('\n')}\n`);
  await atomicJson(path.join(output, 'FAILURE_SIGNATURES.json'), { schemaVersion: 1, head, count: signatures.size, signatures: [...signatures.values()].sort((a, b) => b.count - a.count) });
  await atomicJson(path.join(output, 'COUNTER_RECONCILIATION.json'), counter);
  await atomicJson(path.join(output, 'MISSING_CASES.json'), { schemaVersion: 1, head, missingCaseIds, unexpectedCaseIds });
  await atomicJson(path.join(output, 'DUPLICATE_CASES.json'), { schemaVersion: 1, head, duplicateCaseIds, conflictingRecords });
  await atomicJson(path.join(output, 'BUILD_IDENTITY.json'), { schemaVersion: 1, repository: REPOSITORY, head, mode, shardIdentities: identities, identitySets, checksumEvidence });
  await atomicJson(path.join(output, 'BROWSER_SHARD_SUMMARY.json'), { schemaVersion: 1, head, mode, counter, uniqueSignatures: signatures.size });
  await writeShaSums(output, 'SHA256SUMS.txt');
  const integrityFailed = integrity.observedShards !== EXPECTED_BROWSER_SHARDS || integrity.uniqueShardIds !== EXPECTED_BROWSER_SHARDS || integrity.duplicateShardIds.length || integrity.invalidShardCounts.length || integrity.observedRecords !== EXPECTED_BROWSER_CASES || integrity.uniqueCaseIds !== EXPECTED_BROWSER_CASES || missingCaseIds.length || unexpectedCaseIds.length || duplicateCaseIds.length || conflictingRecords.length || integrity.checksumMissing || integrity.checksumMismatches || !integrity.exactHeadMatch || !integrity.workflowIdentityMatch || !integrity.harnessIdentityMatch;
  console.log(JSON.stringify({ head, mode, counter: counter.global, uniqueSignatures: signatures.size, integrity }, null, 2));
  if (integrityFailed || (mode === 'acceptance' && failures.length)) process.exitCode = 1;
}

async function aggregateA11y() {
  const head = process.env.QELLY_REVIEW_HEAD ?? process.env.GITHUB_SHA ?? git('rev-parse', 'HEAD');
  if (git('rev-parse', 'HEAD') !== head) throw new Error('STALE_HEAD_A11Y_AGGREGATOR');
  const mode = process.env.QELLY_FASTTRACK_MODE ?? 'diagnostic';
  const source = path.resolve(process.env.QELLY_A11Y_ARTIFACT_ROOT ?? '.prompt2b-fasttrack/downloaded-a11y');
  const output = path.resolve('.prompt2b-review');
  await mkdir(output, { recursive: true });
  const files = await findNamedFiles(source, 'A11Y_SHARD_RESULTS.json');
  const shards = [];
  const results = [];
  const checksums = [];
  for (const file of files) {
    const shardRoot = path.dirname(file);
    const payload = JSON.parse(await readFile(file, 'utf8'));
    shards.push(payload);
    results.push(...payload.results);
    checksums.push({ shardRoot: path.relative(source, shardRoot), ...await verifyShaSums(shardRoot, 'A11Y_SHARD_SHA256SUMS.txt') });
  }
  const ids = results.map(item => `${item.route}::${item.viewport}`);
  const duplicateIds = [...new Set(ids.filter((item, index) => ids.indexOf(item) !== index))];
  const missing = [];
  const canonicalRoutes = [
    'auth-login', 'auth-register', 'auth-recovery', 'account-session', 'onboarding', 'discovery-hub', 'live-markets', 'identity-access', 'security-evidence',
    'security-setup', 'secure-import-vault', 'passkey-center', 'account-recovery', 'delivery-operations', 'platform-readiness', 'secret-rotation', 'quarantine-review', 'staging-assurance',
    'calculator-center', 'india-finance', 'indicator-library', 'formula-library', 'saved-calculations', 'formula-detail', 'indicator-detail', 'calculator-detail', 'saved-calculation-detail',
  ];
  for (const route of canonicalRoutes) for (const viewport of ['desktop', 'mobile']) if (!ids.includes(`${route}::${viewport}`)) missing.push(`${route}::${viewport}`);
  const failed = results.filter(item => item.status !== 'passed');
  const identity = {
    exactHeads: [...new Set(shards.map(item => item.exactHead))],
    sourceSha256: [...new Set(shards.map(item => item.canonicalSourceSha256))],
    compiledFontSha256: [...new Set(shards.map(item => item.compiledFontSha256))],
    origins: [...new Set(shards.map(item => item.origin))],
  };
  const integrity = {
    expectedShards: EXPECTED_A11Y_SHARDS, observedShards: shards.length,
    uniqueShardIds: new Set(shards.map(item => item.shardId)).size,
    expectedChecks: EXPECTED_A11Y_CHECKS, observedChecks: results.length,
    uniqueChecks: new Set(ids).size, missing, duplicateIds,
    checksumMissing: checksums.flatMap(item => item.missing).length,
    checksumMismatches: checksums.flatMap(item => item.mismatches).length,
    exactHeadMatch: identity.exactHeads.length === 1 && identity.exactHeads[0] === head,
    sourceIdentityMatch: identity.sourceSha256.length === 1,
    compiledFontIdentityMatch: identity.compiledFontSha256.length === 1,
  };
  const summary = {
    release: 'Prompt 2B fast-track exact-head accessibility',
    generatedAt: now(),
    method: 'automated semantic, keyboard-entry, exact-font and responsive regression; not an independent WCAG certification and not a complete manual assistive-technology audit',
    exactHead: head,
    routeCount: canonicalRoutes.length,
    viewportCount: 2,
    expectedChecks: EXPECTED_A11Y_CHECKS,
    checks: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
    integrity,
    status: failed.length || missing.length || duplicateIds.length ? 'failed' : 'passed',
  };
  await mkdir('validation', { recursive: true });
  await atomicJson('validation/RELEASE_A5_ACCESSIBILITY_REGRESSION.json', summary);
  await atomicJson(path.join(output, 'ACCESSIBILITY_SHARD_SUMMARY.json'), { ...summary, shards, checksums, identity });
  const rows = [['route', 'viewport', 'status', 'criticalFailures', 'screenshot', 'screenshotSha256']];
  for (const item of results) rows.push([item.route, item.viewport, item.status, item.criticalFailures?.join('|') ?? '', item.screenshotPath ?? '', item.screenshotSha256 ?? '']);
  await writeFile(path.join(output, 'ACCESSIBILITY_CHECK_INDEX.csv'), `${rows.map(row => row.map(csv).join(',')).join('\n')}\n`);
  const integrityFailed = integrity.observedShards !== EXPECTED_A11Y_SHARDS || integrity.uniqueShardIds !== EXPECTED_A11Y_SHARDS || integrity.observedChecks !== EXPECTED_A11Y_CHECKS || integrity.uniqueChecks !== EXPECTED_A11Y_CHECKS || missing.length || duplicateIds.length || integrity.checksumMissing || integrity.checksumMismatches || !integrity.exactHeadMatch || !integrity.sourceIdentityMatch || !integrity.compiledFontIdentityMatch;
  console.log(JSON.stringify({ head, mode, checks: results.length, passed: results.length - failed.length, failed: failed.length, integrity }, null, 2));
  if (integrityFailed || (mode === 'acceptance' && failed.length)) process.exitCode = 1;
}

const command = process.argv[2];
if (command === 'browser-shard') await browserShard();
else if (command === 'aggregate-browser') await aggregateBrowser();
else if (command === 'aggregate-a11y') await aggregateA11y();
else throw new Error(`Usage: node ${HARNESS_PATH} <browser-shard|aggregate-browser|aggregate-a11y>`);
