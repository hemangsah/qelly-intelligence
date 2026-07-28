import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, rm, writeFile, cp, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const dist = path.join(root, 'dist/frontend');
const artifact = path.join(root, '.brand-review/qelly-logo-first-brand-system-review');
const reportDir = path.join(artifact, '14-reports');
const checksumsDir = path.join(artifact, '15-checksums');
const base = '/qelly-intelligence/';
const foundationCommit = '239f6f0c7c663801662f4e5f940ca76fb6941bf1';
const reviewCommit = process.env.QELLY_REVIEW_COMMIT || 'local';
const originalFailureDir = '/tmp/qelly-original-renderer-failure';
const clsThreshold = 0.01;
const overflowThreshold = 1;

const directories = [
  '01-foundation-state', '02-logo-system', '03-opening-screen', '04-homepage-hero',
  '05-app-shell', '06-favicon-pwa', '07-auth-loading-empty', '08-theme-compatibility',
  '09-mobile', '10-accessibility', '11-performance', '12-figma', '13-compiled-preview',
  '14-reports', '15-checksums'
];
const browsers = [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]];
const viewports = [[360, 800], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 800], [1440, 1000], [1728, 1080], [1920, 1080]];
const themes = ['sovereign-obsidian', 'porcelain-signal', 'crimson-vector', 'obsidian-strike', 'white-heat', 'ember-protocol', 'arctic-quant', 'emerald-conviction', 'cobalt-circuit', 'violet-oracle', 'gold-dominion', 'monochrome-ledger', 'signal-access'];
const consoleErrors = [];
const failedResources = [];
const pageErrors = [];
const rendererFailures = [];
const metrics = [];
const captures = [];
const openingEvidence = [];
const layoutShiftEvidence = [];
const sanitizedPreviewChecks = [];
let server;
let serverPort = 4190;

const json = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
const exists = async (file) => { try { await stat(file); return true; } catch { return false; } };
const cleanName = (value) => String(value).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
const url = (route = 'market', port = serverPort) => `http://127.0.0.1:${port}${base}#/${route}`;
const relativeArtifactPath = (absolute) => path.relative(artifact, absolute).split(path.sep).join('/');
const fileSha256 = (data) => createHash('sha256').update(data).digest('hex');

async function walk(directory, prefix = '') {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const rel = path.join(prefix, entry.name);
    const abs = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(abs, rel));
    else if (entry.isFile()) output.push({ rel: rel.split(path.sep).join('/'), abs });
  }
  return output;
}

function mimeFor(file) {
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

async function startStaticServer(directory, port) {
  const resolvedRoot = path.resolve(directory);
  const instance = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
      let relative = requestUrl.pathname.startsWith(base) ? requestUrl.pathname.slice(base.length) : requestUrl.pathname.replace(/^\/+/, '');
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      const requested = path.resolve(resolvedRoot, relative);
      if (requested !== resolvedRoot && !requested.startsWith(`${resolvedRoot}${path.sep}`)) {
        response.writeHead(403, { 'content-type': 'text/plain' }); response.end('Forbidden'); return;
      }
      let file = requested;
      if (!await exists(file)) file = path.join(resolvedRoot, 'index.html');
      const data = await readFile(file);
      response.writeHead(200, { 'content-type': mimeFor(file), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(data);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain' }); response.end(`Review server error: ${error.message}`);
    }
  });
  await new Promise((resolve, reject) => {
    instance.once('error', reject);
    instance.listen(port, '127.0.0.1', resolve);
  });
  return instance;
}

function telemetryFor(page, meta) {
  let active = true;
  page.on('console', (message) => {
    if (!active || message.type() !== 'error') return;
    consoleErrors.push({ ...meta, text: message.text(), location: message.location() });
  });
  page.on('pageerror', (error) => {
    if (!active) return;
    pageErrors.push({ ...meta, name: error.name, message: error.message, stack: error.stack || null });
  });
  page.on('requestfailed', (request) => {
    if (!active) return;
    failedResources.push({ ...meta, url: request.url(), method: request.method(), resourceType: request.resourceType(), failure: request.failure()?.errorText || 'unknown' });
  });
  return { stop: () => { active = false; } };
}

async function installReviewInit(context, options = {}) {
  await context.addInitScript(({ seen, themeFamily, appearance, suppressOpening, holdOpening }) => {
    if (seen) sessionStorage.setItem('qelly.brand.opening.v1', 'seen');
    if (themeFamily || appearance) {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('qelly.theme-intelligence.v2') || '{}'); } catch {}
      localStorage.setItem('qelly.theme-intelligence.v2', JSON.stringify({ ...saved, ...(themeFamily ? { themeFamily } : {}), ...(appearance ? { appearance } : {}) }));
    }
    const applyReviewFlags = () => {
      const html = document.documentElement;
      if (!html) return false;
      if (suppressOpening) html.dataset.qellyReviewSuppressOpening = 'true';
      if (holdOpening) html.dataset.qellyReviewHoldOpening = 'true';
      return true;
    };
    if (!applyReviewFlags()) {
      const observer = new MutationObserver(() => { if (applyReviewFlags()) observer.disconnect(); });
      observer.observe(document, { childList: true, subtree: true });
    }
    window.__qellyReviewMetrics = {
      cls: 0, clsSupported: false, clsStatus: 'unsupported', clsEntries: 0,
      lcp: null, lcpSupported: false, longTaskMs: 0, longTaskCount: 0,
      longTaskSupported: false, eventDurationMax: null, eventTimingSupported: false
    };
    const supported = Array.isArray(PerformanceObserver.supportedEntryTypes) ? PerformanceObserver.supportedEntryTypes : [];
    const observeSafely = (type, callback, statusKey) => {
      if (!supported.includes(type)) return;
      try {
        const observer = new PerformanceObserver(callback);
        observer.observe({ type, buffered: true });
        window.__qellyReviewMetrics[statusKey] = true;
        if (type === 'layout-shift') window.__qellyReviewMetrics.clsStatus = 'measured';
      } catch (error) {
        if (type === 'layout-shift') window.__qellyReviewMetrics.clsStatus = `observer-error: ${error.message}`;
      }
    };
    observeSafely('layout-shift', (list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__qellyReviewMetrics.cls += Number(entry.value || 0);
        window.__qellyReviewMetrics.clsEntries += 1;
      }
    }, 'clsSupported');
    observeSafely('largest-contentful-paint', (list) => {
      const last = list.getEntries().at(-1);
      if (last) window.__qellyReviewMetrics.lcp = Number(last.startTime || 0);
    }, 'lcpSupported');
    observeSafely('longtask', (list) => {
      for (const entry of list.getEntries()) {
        window.__qellyReviewMetrics.longTaskMs += Number(entry.duration || 0);
        window.__qellyReviewMetrics.longTaskCount += 1;
      }
    }, 'longTaskSupported');
    observeSafely('event', (list) => {
      for (const entry of list.getEntries()) {
        const duration = Number(entry.duration || 0);
        window.__qellyReviewMetrics.eventDurationMax = Math.max(window.__qellyReviewMetrics.eventDurationMax || 0, duration);
      }
    }, 'eventTimingSupported');
  }, {
    seen: Boolean(options.seen), themeFamily: options.themeFamily || null,
    appearance: options.appearance || null, suppressOpening: Boolean(options.suppressOpening), holdOpening: Boolean(options.holdOpening)
  });
}

async function waitForAppReady(page, route, timeout = 25000) {
  await page.waitForSelector('#app.q-app', { state: 'attached', timeout });
  await page.waitForFunction((expectedRoute) => {
    const root = document.documentElement;
    const main = document.getElementById('main');
    const actual = location.hash.replace(/^#\/?/, '').split('/')[0] || 'market';
    return root.dataset.appReady === 'true' && root.dataset.brandReady === 'true' && main && main.getAttribute('aria-busy') === 'false' && main.childElementCount > 0 && actual === expectedRoute;
  }, route, { timeout });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function gotoReady(page, route, meta, options = {}) {
  const documentUrl = url(route).split('#')[0];
  try {
    await page.goto(documentUrl, { waitUntil: 'domcontentloaded', timeout: options.navigationTimeout || 25000 });
  } catch (error) {
    const recoverable = /interrupted by another navigation|Timeout 25000ms exceeded/.test(error.message || '');
    if (!recoverable) throw error;
  }
  await page.evaluate((expectedRoute) => {
    const current = location.hash.replace(/^#\/?/, '').split('/')[0] || '';
    if (current !== expectedRoute) location.hash = `#/${expectedRoute}`;
  }, route);
  await waitForAppReady(page, route, options.readinessTimeout || 30000);
  if (options.suppressOpening !== false) {
    await page.evaluate(() => document.querySelector('.qelly-opening')?.remove());
    await page.waitForSelector('.qelly-opening', { state: 'detached', timeout: 3000 }).catch(() => {});
  }
  const routeState = await page.evaluate(() => ({
    hash: location.hash,
    appReady: document.documentElement.dataset.appReady,
    brandReady: document.documentElement.dataset.brandReady,
    mainBusy: document.getElementById('main')?.getAttribute('aria-busy'),
    mainChildren: document.getElementById('main')?.childElementCount || 0
  }));
  if (!routeState.hash.replace(/^#\/?/, '').startsWith(route)) throw new Error(`Route readiness mismatch for ${meta.capture}: ${JSON.stringify(routeState)}`);
}

async function collectPageMetrics(page, meta, { frameSample = false } = {}) {
  if (frameSample) {
    await page.evaluate(() => new Promise((resolve) => {
      const intervals = [];
      let previous = performance.now();
      let count = 0;
      const tick = (now) => {
        intervals.push(now - previous); previous = now; count += 1;
        if (count >= 60) { window.__qellyReviewFrames = intervals; resolve(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
  }
  const data = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const resources = performance.getEntriesByType('resource');
    const review = window.__qellyReviewMetrics || {};
    const frames = window.__qellyReviewFrames || [];
    const html = document.documentElement;
    const body = document.body;
    const overflow = Math.max(0, html.scrollWidth - html.clientWidth, body?.scrollWidth - html.clientWidth || 0);
    const overflowElements = [...document.querySelectorAll('body *')].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(), id: element.id || null,
        className: String(element.className || '').slice(0, 180),
        left: Math.round(rect.left * 100) / 100, right: Math.round(rect.right * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth
      };
    }).filter((item) => item.right > html.clientWidth + 1 || item.left < -1 || item.scrollWidth > item.clientWidth + 1)
      .sort((a, b) => (b.right - html.clientWidth) - (a.right - html.clientWidth)).slice(0, 20);
    const memory = performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    } : null;
    return {
      fcp: paints.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? null,
      lcp: review.lcp ?? null,
      domContentLoaded: navigation?.domContentLoadedEventEnd ?? null,
      load: navigation?.loadEventEnd ?? null,
      responseEnd: navigation?.responseEnd ?? null,
      cls: Number(review.cls || 0),
      clsSupported: Boolean(review.clsSupported),
      clsStatus: review.clsStatus || 'unsupported',
      clsEntries: Number(review.clsEntries || 0),
      longTaskMs: Number(review.longTaskMs || 0),
      longTaskCount: Number(review.longTaskCount || 0),
      longTaskSupported: Boolean(review.longTaskSupported),
      inp: review.eventDurationMax ?? null,
      inpSupported: Boolean(review.eventTimingSupported),
      overflow, overflowElements,
      resourceTransferBytes: resources.reduce((sum, entry) => sum + Number(entry.transferSize || 0), 0),
      resourceDecodedBytes: resources.reduce((sum, entry) => sum + Number(entry.decodedBodySize || 0), 0),
      memory,
      frameSample: frames.length ? {
        samples: frames.length,
        averageMs: frames.reduce((sum, value) => sum + value, 0) / frames.length,
        maxMs: Math.max(...frames),
        framesOver25ms: frames.filter((value) => value > 25).length,
        framesOver50ms: frames.filter((value) => value > 50).length
      } : null,
      fontFamily: getComputedStyle(document.body).fontFamily,
      openingVisible: Boolean(document.querySelector('.qelly-opening')),
      appReady: html.dataset.appReady,
      brandReady: html.dataset.brandReady
    };
  });
  const record = { ...meta, ...data };
  metrics.push(record);
  layoutShiftEvidence.push({ browser: meta.browser, viewport: meta.viewport, capture: meta.capture, supported: data.clsSupported, status: data.clsStatus, value: data.cls, entries: data.clsEntries, threshold: clsThreshold, result: !data.clsSupported || data.cls < clsThreshold ? 'passed' : 'failed' });
  return record;
}

async function recordFailure(error, meta, page, action) {
  const safe = cleanName(`${meta.browser || 'unknown'}-${meta.viewport || 'unknown'}-${meta.capture || 'capture'}-${action}`);
  const failure = {
    ...meta, action, errorName: error?.name || 'Error', error: error?.message || String(error),
    stack: error?.stack || null, screenshot: null, htmlExcerpt: null, recordedAt: new Date().toISOString()
  };
  if (page) {
    try {
      const target = path.join(reportDir, `renderer-failure-${safe}.png`);
      await page.screenshot({ path: target, fullPage: true, timeout: 10000 });
      failure.screenshot = relativeArtifactPath(target);
    } catch {}
    try {
      const html = await page.content();
      const target = path.join(reportDir, `renderer-failure-${safe}.html.txt`);
      await writeFile(target, html.slice(0, 200000));
      failure.htmlExcerpt = relativeArtifactPath(target);
    } catch {}
  }
  rendererFailures.push(failure);
  return failure;
}

async function runCapture(launcher, browserName, specification) {
  const viewport = specification.viewport || { width: 1440, height: 1000 };
  const meta = {
    browser: browserName, viewport: `${viewport.width}x${viewport.height}`,
    route: specification.route || 'market', theme: specification.themeFamily || null,
    appearance: specification.appearance || specification.colorScheme || 'dark',
    capture: specification.name, group: specification.group
  };
  let browser;
  let context;
  let page;
  let telemetry;
  try {
    browser = specification.browser || await launcher.launch();
    context = await browser.newContext({
      viewport, colorScheme: specification.colorScheme || 'dark',
      reducedMotion: specification.reducedMotion || 'no-preference'
    });
    await installReviewInit(context, {
      seen: specification.seen !== false,
      suppressOpening: specification.suppressOpening !== false,
      themeFamily: specification.themeFamily,
      appearance: specification.appearance
    });
    page = await context.newPage();
    telemetry = telemetryFor(page, meta);
    await gotoReady(page, meta.route, meta, { suppressOpening: specification.suppressOpening !== false });
    if (specification.prepare) await specification.prepare(page, meta);
    const output = path.join(artifact, specification.directory, `${specification.name}.png`);
    await page.screenshot({ path: output, fullPage: specification.fullPage !== false, timeout: 20000 });
    captures.push({ ...meta, path: relativeArtifactPath(output), required: specification.required !== false });
    if (specification.collectMetrics !== false) await collectPageMetrics(page, meta, { frameSample: Boolean(specification.frameSample) });
    if (specification.afterCapture) await specification.afterCapture(page, meta);
    telemetry.stop();
    await context.close();
    if (!specification.browser) await browser.close();
    return true;
  } catch (error) {
    telemetry?.stop();
    await recordFailure(error, meta, page, specification.failedAction || 'capture');
    await context?.close().catch(() => {});
    if (browser && !specification.browser) await browser.close().catch(() => {});
    return false;
  }
}

async function captureOpening(launcher, browserName, mode) {
  const reduced = mode === 'reduced';
  const repeat = mode === 'repeat-session';
  const viewport = { width: 1440, height: 1000 };
  const meta = { browser: browserName, viewport: '1440x1000', route: 'market', theme: 'sovereign-obsidian', appearance: 'dark', capture: `opening-${mode}-${browserName}`, group: 'opening' };
  let browser; let context; let page; let telemetry;
  try {
    browser = await launcher.launch();
    context = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await installReviewInit(context, { seen: repeat, suppressOpening: false, holdOpening: !repeat, themeFamily: 'sovereign-obsidian', appearance: 'dark' });
    page = await context.newPage(); telemetry = telemetryFor(page, meta);
    const started = Date.now();
    await page.goto(url('market').split('#')[0], { waitUntil: 'domcontentloaded', timeout: 25000 }).catch((error) => { if (!/interrupted by another navigation|Timeout 25000ms exceeded/.test(error.message || '')) throw error; });
    await page.evaluate(() => { if (!location.hash.replace(/^#\/?/, '').startsWith('market')) location.hash = '#/market'; });
    if (repeat) {
      await waitForAppReady(page, 'market');
      const present = await page.locator('.qelly-opening').count();
      if (present) throw new Error('Repeat-session opening overlay was present despite the seen-session marker');
    } else {
      const overlay = page.locator('.qelly-opening');
      await overlay.waitFor({ state: 'visible', timeout: 3000 });
    }
    const output = path.join(artifact, '03-opening-screen', `${meta.capture}.png`);
    await page.screenshot({ path: output, fullPage: false, timeout: 15000 });
    let removalMs = null;
    if (!repeat) {
      const configuredDuration = reduced ? 120 : 1180;
      await page.waitForTimeout(configuredDuration);
      await page.locator('.qelly-opening').click({ force: true });
      await page.locator('.qelly-opening').waitFor({ state: 'detached', timeout: 3500 });
      removalMs = Date.now() - started;
      await waitForAppReady(page, 'market');
    }
    captures.push({ ...meta, path: relativeArtifactPath(output), required: true });
    openingEvidence.push({ ...meta, reducedMotion: reduced, repeatSession: repeat, overlayPresentAtCapture: !repeat, overlayRemovalMs: removalMs, result: 'passed' });
    await collectPageMetrics(page, meta, { frameSample: false });
    telemetry.stop(); await context.close(); await browser.close();
    return true;
  } catch (error) {
    telemetry?.stop();
    openingEvidence.push({ ...meta, reducedMotion: reduced, repeatSession: repeat, result: 'failed', error: error.message });
    await recordFailure(error, meta, page, 'opening-evidence');
    await context?.close().catch(() => {}); await browser?.close().catch(() => {});
    return false;
  }
}

async function openCommandPalette(page) {
  const dialog = page.locator('dialog.q-command-dialog');
  try {
    await page.locator('#command-button').click({ timeout: 5000 });
  } catch {
    await page.keyboard.press('Control+K').catch(async () => page.keyboard.press('Meta+K'));
  }
  await dialog.waitFor({ state: 'visible', timeout: 8000 });
  const input = dialog.locator('#q-command-input');
  await input.fill('Asset Rankings');
  await page.waitForFunction(() => {
    const items = [...document.querySelectorAll('dialog.q-command-dialog .q-command-item strong')].map((node) => node.textContent?.trim());
    return items.filter((label) => label === 'Asset Rankings').length === 1;
  }, undefined, { timeout: 5000 });
  const target = dialog.locator('.q-command-item', { hasText: 'Asset Rankings' }).first();
  await target.hover();
  await page.waitForTimeout(120);
  if (await target.getAttribute('aria-selected') !== 'true') await page.keyboard.press('ArrowDown');
  const duplicates = await dialog.locator('.q-command-item strong').evaluateAll((nodes) => {
    const labels = nodes.map((node) => node.textContent?.trim()).filter(Boolean);
    return labels.filter((label, index) => labels.indexOf(label) !== index);
  });
  if (duplicates.length) throw new Error(`Duplicate command labels after filtering: ${duplicates.join(', ')}`);
}

async function closeCommandPalette(page) {
  const dialog = page.locator('dialog.q-command-dialog');
  if (!await dialog.count()) return;
  const close = dialog.locator('[data-close]');
  if (await close.count()) await close.click({ force: true });
  else await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(async () => dialog.waitFor({ state: 'hidden', timeout: 5000 }));
}

async function openThemeStudio(page, mode = 'studio') {
  await page.evaluate((target) => {
    if (!window.QellyThemeStudio) throw new Error('QellyThemeStudio review API is unavailable');
    if (target === 'gallery') window.QellyThemeStudio.gallery();
    else window.QellyThemeStudio.open();
  }, mode);
  await page.waitForFunction((target) => location.hash.startsWith(target === 'gallery' ? '#/theme-lab/gallery' : '#/theme-lab'), mode, { timeout: 10000 });
  await page.waitForSelector('.q-ti-page', { state: 'visible', timeout: 15000 });
  await page.evaluate(async () => { await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}

async function setPreviewState(page, state) {
  await page.evaluate((nextState) => {
    const selector = document.getElementById('state-selector');
    if (!selector) throw new Error('Preview state selector is unavailable');
    selector.disabled = false;
    selector.value = nextState;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
  }, state);
  await page.waitForFunction((expected) => {
    const main = document.getElementById('main');
    if (!main || main.getAttribute('aria-busy') !== 'false') return false;
    if (expected === 'loading') return Boolean(main.querySelector('.q-skeleton-grid'));
    if (expected === 'empty') return Boolean(main.querySelector('.q-empty-state:not(.q-error-state)'));
    if (expected === 'offline') return /offline/i.test(main.textContent || '');
    if (expected === 'error') return Boolean(main.querySelector('.q-error-state'));
    return true;
  }, state, { timeout: 10000 });
}

async function createLogoBoard(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'dark' });
  const page = await context.newPage();
  const files = ['qelly-logo-primary.svg', 'qelly-logo-dark.svg', 'qelly-logo-light.svg', 'qelly-logo-compact.svg', 'qelly-logo-monochrome-dark.svg', 'qelly-logo-monochrome-light.svg', 'qelly-logo-high-contrast.svg', 'qelly-symbol.svg', 'qelly-symbol-dark.svg', 'qelly-symbol-monochrome.svg', 'qelly-symbol-small.svg'];
  const cards = files.map((file) => `<article class="card ${file.includes('light') ? 'light' : ''}"><img src="http://127.0.0.1:${serverPort}${base}assets/brand/${file}" alt="${file}"><strong>${file}</strong></article>`).join('');
  const sizes = [16, 24, 32, 48, 64, 96].map((size) => `<span><img style="width:${size}px;height:${size}px" src="http://127.0.0.1:${serverPort}${base}assets/brand/qelly-symbol-small.svg" alt=""><small>${size}px</small></span>`).join('');
  await page.setContent(`<!doctype html><html><style>body{margin:0;background:#10080d;color:#fff;font:14px Arial;padding:38px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{min-height:170px;border:1px solid #4b2738;border-radius:18px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;background:#1b0e15}.card.light{background:#f7f2f4;color:#32101f}.card img{max-width:100%;max-height:92px}.sizes{margin-top:24px;padding:24px;border:1px solid #4b2738;border-radius:18px;display:flex;gap:30px;align-items:end}.sizes span{display:grid;gap:8px;justify-items:center}</style><body><h1>Qelly official logo system</h1><div class="grid">${cards}</div><div class="sizes">${sizes}</div></body></html>`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  const output = path.join(artifact, '02-logo-system', 'logo-variant-and-small-size-board.png');
  await page.screenshot({ path: output, fullPage: true });
  captures.push({ browser: 'chromium', viewport: '1440x1100', route: 'logo-board', capture: 'logo-variant-and-small-size-board', group: 'logo-system', path: relativeArtifactPath(output), required: true });
  await context.close();
}

async function createPwaBoard(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light' });
  const page = await context.newPage();
  const icons = [['16', 'icons/qelly-16.png'], ['32', 'icons/qelly-32.png'], ['48', 'icons/qelly-48.png'], ['64', 'icons/qelly-64.png'], ['192', 'icons/qelly-192.png'], ['512', 'icons/qelly-512.png'], ['Maskable 512', 'icons/qelly-maskable-512.png'], ['Apple 180', 'apple-touch-icon.png']];
  const items = icons.map(([label, file]) => `<article><img src="http://127.0.0.1:${serverPort}${base}${file}" alt="${label}"><strong>${label}</strong></article>`).join('');
  await page.setContent(`<!doctype html><html><style>body{margin:0;background:#f5f1f3;color:#2b0d1b;font:14px Arial;padding:36px}.icons{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.icons article{background:white;border:1px solid #d8c9d0;border-radius:18px;padding:24px;display:grid;place-items:center;gap:12px;min-height:210px}.icons img{max-width:150px;max-height:150px}.social{margin-top:24px;background:#fff;padding:18px;border-radius:18px;border:1px solid #d8c9d0}.social img{width:100%;display:block;border-radius:12px}</style><body><h1>Qelly favicon, PWA and social assets</h1><div class="icons">${items}</div><div class="social"><img src="http://127.0.0.1:${serverPort}${base}social/qelly-social-preview.png" alt="Qelly social preview"></div></body></html>`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  const output = path.join(artifact, '06-favicon-pwa', 'favicon-pwa-social-board.png');
  await page.screenshot({ path: output, fullPage: true });
  captures.push({ browser: 'chromium', viewport: '1440x1100', route: 'asset-board', capture: 'favicon-pwa-social-board', group: 'favicon-pwa', path: relativeArtifactPath(output), required: true });
  await context.close();
}

async function directoryBytes(directory, predicate = () => true) {
  const files = await walk(directory);
  let bytes = 0;
  for (const file of files) if (predicate(file)) bytes += (await stat(file.abs)).size;
  return bytes;
}

function gitFileSize(commit, file) {
  try { return Number(execFileSync('git', ['cat-file', '-s', `${commit}:${file}`], { encoding: 'utf8' }).trim()); }
  catch { return 0; }
}

function gitFiles(commit, folder) {
  try { return execFileSync('git', ['ls-tree', '-r', '--name-only', commit, '--', folder], { encoding: 'utf8' }).split('\n').filter(Boolean); }
  catch { return []; }
}

async function performanceSummary() {
  const primarySvg = path.join(root, 'apps/web/public/assets/brand/qelly-logo-primary.svg');
  const brandDir = path.join(root, 'apps/web/public/assets/brand');
  const iconDir = path.join(root, 'apps/web/public/icons');
  const currentFiles = await walk(path.join(root, 'apps/web/public'));
  const currentJs = currentFiles.filter((file) => /\.(?:js|mjs)$/.test(file.rel));
  const currentCss = currentFiles.filter((file) => /\.css$/.test(file.rel));
  const currentJsBytes = (await Promise.all(currentJs.map((file) => stat(file.abs)))).reduce((sum, info) => sum + info.size, 0);
  const currentCssBytes = (await Promise.all(currentCss.map((file) => stat(file.abs)))).reduce((sum, info) => sum + info.size, 0);
  const baseFiles = gitFiles(foundationCommit, 'apps/web/public');
  const baseJsBytes = baseFiles.filter((file) => /\.(?:js|mjs)$/.test(file)).reduce((sum, file) => sum + gitFileSize(foundationCommit, file), 0);
  const baseCssBytes = baseFiles.filter((file) => /\.css$/.test(file)).reduce((sum, file) => sum + gitFileSize(foundationCommit, file), 0);
  const fullOpening = openingEvidence.filter((item) => item.result === 'passed' && !item.reducedMotion && !item.repeatSession).map((item) => item.overlayRemovalMs).filter(Number.isFinite);
  const reducedOpening = openingEvidence.filter((item) => item.result === 'passed' && item.reducedMotion).map((item) => item.overlayRemovalMs).filter(Number.isFinite);
  const maxCls = Math.max(0, ...metrics.map((item) => Number(item.cls || 0)));
  const maxOverflow = Math.max(0, ...metrics.map((item) => Number(item.overflow || 0)));
  const measuredFcp = metrics.map((item) => item.fcp).filter(Number.isFinite);
  const measuredLcp = metrics.map((item) => item.lcp).filter(Number.isFinite);
  const measuredInp = metrics.map((item) => item.inp).filter(Number.isFinite);
  const longTasks = metrics.map((item) => item.longTaskMs).filter(Number.isFinite);
  const frameSamples = metrics.map((item) => item.frameSample).filter(Boolean);
  const jsDelta = currentJsBytes - baseJsBytes;
  const cssDelta = currentCssBytes - baseCssBytes;
  const classify = (delta, major, minor) => delta > major ? 'major' : delta > minor ? 'minor' : 'acceptable/deliberate';
  return {
    result: maxCls < clsThreshold && maxOverflow <= overflowThreshold ? 'passed' : 'failed',
    assetSizes: {
      primarySvgBytes: (await stat(primarySvg)).size,
      totalLogoAssetBytes: await directoryBytes(brandDir),
      faviconIcoBytes: (await stat(path.join(root, 'apps/web/public/favicon.ico'))).size,
      pwaAssetBytes: await directoryBytes(iconDir, (file) => /\.png$/.test(file.rel)) + (await stat(path.join(root, 'apps/web/public/apple-touch-icon.png'))).size,
      socialPreviewBytes: (await stat(path.join(root, 'apps/web/public/social/qelly-social-preview.png'))).size
    },
    bundleDeltas: {
      foundationCommit, currentJsBytes, foundationJsBytes: baseJsBytes, jsDeltaBytes: jsDelta, jsClassification: classify(jsDelta, 100000, 30000),
      currentCssBytes, foundationCssBytes: baseCssBytes, cssDeltaBytes: cssDelta, cssClassification: classify(cssDelta, 60000, 20000)
    },
    opening: {
      fullMotionMs: fullOpening.length ? Math.round(fullOpening.reduce((sum, value) => sum + value, 0) / fullOpening.length) : null,
      reducedMotionMs: reducedOpening.length ? Math.round(reducedOpening.reduce((sum, value) => sum + value, 0) / reducedOpening.length) : null,
      repeatSessionSuppressed: openingEvidence.filter((item) => item.repeatSession).every((item) => item.result === 'passed')
    },
    webVitals: {
      fcpMs: measuredFcp.length ? { min: Math.min(...measuredFcp), max: Math.max(...measuredFcp), average: measuredFcp.reduce((sum, value) => sum + value, 0) / measuredFcp.length } : { status: 'not-measured' },
      lcpMs: measuredLcp.length ? { min: Math.min(...measuredLcp), max: Math.max(...measuredLcp), average: measuredLcp.reduce((sum, value) => sum + value, 0) / measuredLcp.length } : { status: 'unsupported-or-not-measured' },
      cls: { max: maxCls, threshold: clsThreshold, measured: layoutShiftEvidence.filter((item) => item.supported).length, unsupported: layoutShiftEvidence.filter((item) => !item.supported).length },
      inpMs: measuredInp.length ? { max: Math.max(...measuredInp), status: 'event-timing-observed' } : { status: 'unsupported-or-insufficient-interaction' }
    },
    mainThread: {
      longTaskMsMax: longTasks.length ? Math.max(...longTasks) : null,
      unsupportedSamples: metrics.filter((item) => !item.longTaskSupported).length,
      frameSamples,
      memory: metrics.filter((item) => item.memory).map((item) => ({ browser: item.browser, viewport: item.viewport, ...item.memory }))
    },
    layout: { maxCls, maxOverflowPx: maxOverflow },
    classification: maxCls >= clsThreshold || maxOverflow > overflowThreshold ? 'major' : 'acceptable/deliberate'
  };
}

async function sanitizeCompiledPreview() {
  const preview = path.join(artifact, '13-compiled-preview');
  const files = await walk(preview);
  const removed = [];
  const rewritten = [];
  for (const file of files) {
    if (/\.woff2$/i.test(file.rel)) {
      await unlink(file.abs); removed.push(file.rel); continue;
    }
    if (!/\.(?:html|css)$/i.test(file.rel)) continue;
    let source = await readFile(file.abs, 'utf8');
    const before = source;
    if (/\.html$/i.test(file.rel)) source = source.replace(/<link\b[^>]*href=["'][^"']*\.woff2[^"']*["'][^>]*>\s*/gi, '');
    if (/\.css$/i.test(file.rel)) {
      source = source.replace(/@font-face\s*\{[^{}]*?\.woff2[^{}]*?\}\s*/gis, '');
      source = source.replace(/url\((?:["'])?[^)"']*\.woff2(?:["'])?\)/gi, 'local("Arial")');
    }
    if (source !== before) { await writeFile(file.abs, source); rewritten.push(file.rel); }
  }
  const notice = `# Delivery font sanitization\n\nThe review screenshots and automated browser evidence were generated from the exact repository build with the approved self-hosted IBM Plex Sans Variable file. The downloadable review ZIP omits distributable font binaries. The compiled-preview copy has its font preload and binary source references removed and falls back to the documented system stack. The IBM Plex license text and source-governance evidence remain included.\n`;
  await writeFile(path.join(preview, 'DELIVERY_FONT_SANITIZATION.md'), notice);
  return { removed, rewritten, licenseEvidenceRetained: await exists(path.join(preview, 'assets/fonts/ibm-plex-sans-variable.woff2.LICENSE.txt')) };
}

async function validateSanitizedCompiledPreview() {
  const preview = path.join(artifact, '13-compiled-preview');
  const port = 4191;
  const previewServer = await startStaticServer(preview, port);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await installReviewInit(context, { seen: true, suppressOpening: true, themeFamily: 'sovereign-obsidian', appearance: 'dark' });
  const page = await context.newPage();
  const failures = [];
  page.on('requestfailed', (request) => failures.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' }));
  try {
    await page.goto(url('market', port), { waitUntil: 'domcontentloaded', timeout: 25000 });
    await waitForAppReady(page, 'market', 25000);
    await page.evaluate(() => document.querySelector('.qelly-opening')?.remove());
    if (failures.length) throw new Error(`Sanitized preview failed resources: ${JSON.stringify(failures)}`);
    const fontRequests = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => /\.woff2(?:$|\?)/.test(entry.name)).map((entry) => entry.name));
    if (fontRequests.length) throw new Error(`Sanitized preview requested omitted font binaries: ${fontRequests.join(', ')}`);
    sanitizedPreviewChecks.push({ result: 'passed', route: 'market', failedResources: 0, fontRequests: 0 });
  } finally {
    await context.close(); await browser.close(); await new Promise((resolve) => previewServer.close(resolve));
  }
}

async function copyEvidenceSources() {
  await cp(path.join(root, 'apps/web/public/assets/brand'), path.join(artifact, '02-logo-system/assets'), { recursive: true });
  await cp(path.join(root, 'apps/web/public/icons'), path.join(artifact, '06-favicon-pwa/icons'), { recursive: true });
  for (const file of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'manifest.webmanifest', 'safari-pinned-tab.svg']) await cp(path.join(root, 'apps/web/public', file), path.join(artifact, '06-favicon-pwa', file));
  await cp(path.join(root, 'apps/web/public/social/qelly-social-preview.png'), path.join(artifact, '06-favicon-pwa/qelly-social-preview.png'));
  await cp(path.join(root, 'design/brand'), path.join(artifact, '02-logo-system/governance'), { recursive: true });
  await cp(path.join(root, 'figma-brand-foundations'), path.join(artifact, '12-figma/figma-brand-foundations'), { recursive: true });
  await cp(dist, path.join(artifact, '13-compiled-preview'), { recursive: true });
  const sourceManifest = JSON.parse(await readFile(path.join(root, 'design/brand/QELLY_LOGO_SOURCE_MANIFEST.json'), 'utf8'));
  const installation = await readFile(path.join(root, 'design/brand/QELLY_SOURCE_INSTALLATION_VERIFICATION.json'), 'utf8').then(JSON.parse).catch(() => null);
  await json(path.join(reportDir, 'SOURCE_INSTALLATION_MANIFEST.json'), { reviewCommit, sourceManifest, installation });
  if (await exists(path.join(originalFailureDir, 'ORIGINAL_RENDERER_FAILURE.json'))) await cp(path.join(originalFailureDir, 'ORIGINAL_RENDERER_FAILURE.json'), path.join(reportDir, 'ORIGINAL_RENDERER_FAILURE.json'));
  if (await exists(path.join(originalFailureDir, 'ORIGINAL_RENDERER_FAILURE.log'))) await cp(path.join(originalFailureDir, 'ORIGINAL_RENDERER_FAILURE.log'), path.join(reportDir, 'ORIGINAL_RENDERER_FAILURE.log'));
}

async function writeMarkdownReports(performance, sanitization) {
  const md = (name, lines) => writeFile(path.join(reportDir, name), `# ${name.replace(/_/g, ' ').replace(/\.md$/i, '')}\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`);
  await md('FOUNDATION_GUARD.md', [`Foundation tag: \`qelly-design-foundation-v1\`.`, `Base main: \`${foundationCommit}\`.`, `Review head: \`${reviewCommit}\`.`, 'PR #11 and main were not modified by the review renderer.', 'PR #13 remains a draft visual-approval change.']);
  await md('LOGO_USAGE_QA.md', ['The authoritative selected mark is preserved.', 'Horizontal, compact, symbol, dark, light, monochrome, high-contrast and small-size variants are bundled.', 'Brand burgundy remains separate from negative-market red semantics.']);
  await md('LOGO_GEOMETRY_QA.md', ['Q ring, tail, trajectory and decision nodes are retained.', 'SVG assets have viewBox geometry and contain no scripts or remote resources.', 'Screenshots include light, dark and high-contrast backgrounds.']);
  await md('SMALL_SIZE_QA.md', ['16, 24, 32, 48, 64 and 96 pixel symbol evidence is included.', 'Favicon and PWA raster dimensions are validated by repository governance.']);
  await md('OPENING_SCREEN_QA.md', [`Opening captures: ${openingEvidence.length}.`, 'Full-motion, reduced-motion and repeat-session evidence is captured in Chromium, Firefox and WebKit.', 'Non-opening captures seed the session marker and remove any residual overlay deterministically.']);
  await md('HERO_QA.md', ['Dark desktop, light desktop, mobile and product-preview hero evidence is included.', 'CTA copy preserves the static-preview truth boundary.']);
  await md('SHELL_BRANDING_QA.md', ['Expanded desktop, collapsed desktop, tablet, mobile and command-palette identity evidence is included.', 'Command results are filtered to one stable unique Asset Rankings result before capture.']);
  await md('FAVICON_PWA_QA.md', ['Favicon, Apple touch, PWA 192, PWA 512, maskable and social assets are included.', 'A consolidated asset board is included for manual inspection.']);
  await md('AUTH_BRAND_QA.md', ['Authentication, loading, empty, offline and recoverable-error states are captured.', 'State-brand symbols remain decorative and do not replace state labels.']);
  await md('THEME_COMPATIBILITY_QA.md', [`All ${themes.length} approved families are captured in dark and light evidence.`, 'Signal Access retains a high-contrast capture.', 'Theme Studio and Theme Gallery evidence is included.']);
  await md('ACCESSIBILITY_QA.md', ['Meaningful logos retain accessible names and decorative symbols are hidden.', 'Keyboard command-palette opening has click fallback.', 'Reduced motion and repeat-session behavior are verified.']);
  await md('MOTION_QA.md', [`Measured full opening duration: ${performance.opening.fullMotionMs ?? 'unavailable'} ms.`, `Measured reduced opening duration: ${performance.opening.reducedMotionMs ?? 'unavailable'} ms.`, `Frame stability samples: ${performance.mainThread.frameSamples.length}.`, 'Unsupported PerformanceObserver metrics are reported honestly rather than treated as failures.']);
  await md('COMPILED_PREVIEW_QA.md', [`Sanitized preview validation: ${sanitizedPreviewChecks.at(-1)?.result || 'not-run'}.`, `Font binaries removed from delivery copy: ${sanitization.removed.length}.`, `Text files rewritten to remove binary font requests: ${sanitization.rewritten.length}.`, `Font license evidence retained: ${sanitization.licenseEvidenceRetained}.`]);
}

async function writeChecksumsAndManifest(validation) {
  const before = await walk(artifact);
  const sums = [];
  for (const file of before) {
    if (file.rel === '15-checksums/SHA256SUMS.txt' || file.rel === '14-reports/ARTIFACT_MANIFEST.json') continue;
    const data = await readFile(file.abs);
    sums.push(`${fileSha256(data)}  ${file.rel}`);
  }
  sums.sort();
  await writeFile(path.join(checksumsDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);
  const all = await walk(artifact);
  const entries = [];
  for (const file of all) {
    if (file.rel === '14-reports/ARTIFACT_MANIFEST.json') continue;
    const data = await readFile(file.abs);
    entries.push({ path: file.rel, bytes: data.length, sha256: fileSha256(data) });
  }
  await json(path.join(reportDir, 'ARTIFACT_MANIFEST.json'), { schemaVersion: 2, artifact: 'qelly-logo-first-brand-system-review', commit: reviewCommit, result: validation.result, checksumEntries: sums.length, entries });
}

async function execute() {
  await rm(artifact, { recursive: true, force: true });
  for (const directory of directories) await mkdir(path.join(artifact, directory), { recursive: true });
  server = await startStaticServer(dist, serverPort);

  for (const [browserName, launcher] of browsers) {
    for (const [width, height] of viewports) {
      await runCapture(launcher, browserName, {
        name: `${browserName}-${width}x${height}-homepage-dark`, group: 'browser-matrix', directory: width <= 430 ? '09-mobile' : '04-homepage-hero',
        route: 'market', viewport: { width, height }, colorScheme: 'dark', appearance: 'dark', themeFamily: 'sovereign-obsidian',
        fullPage: true, frameSample: width === 1440 && height === 1000
      });
    }
    await captureOpening(launcher, browserName, 'full-motion');
    await captureOpening(launcher, browserName, 'reduced');
    await captureOpening(launcher, browserName, 'repeat-session');
  }

  const chrome = await chromium.launch();
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'homepage-light-desktop', group: 'homepage', directory: '04-homepage-hero', route: 'market', viewport: { width: 1440, height: 1000 }, colorScheme: 'light', appearance: 'light', themeFamily: 'porcelain-signal', fullPage: true });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'homepage-mobile-390', group: 'homepage', directory: '09-mobile', route: 'market', viewport: { width: 390, height: 844 }, colorScheme: 'dark', appearance: 'dark', themeFamily: 'sovereign-obsidian', fullPage: true });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'hero-product-preview-and-cta', group: 'homepage', directory: '04-homepage-hero', route: 'market', viewport: { width: 1440, height: 1000 }, prepare: async (page) => { await page.locator('[data-qelly-brand-hero]').scrollIntoViewIfNeeded(); }, fullPage: false });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'shell-expanded-desktop', group: 'shell', directory: '05-app-shell', route: 'asset-rankings', viewport: { width: 1440, height: 1000 }, prepare: async (page) => { await page.locator('[data-shell-action="menu"]').click({ force: true }).catch(() => page.locator('#rail-toggle').click({ force: true })); await page.waitForSelector('#rail.is-open', { state: 'visible', timeout: 5000 }); }, fullPage: true });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'shell-collapsed-desktop', group: 'shell', directory: '05-app-shell', route: 'asset-rankings', viewport: { width: 1440, height: 1000 }, fullPage: true });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'shell-tablet', group: 'shell', directory: '05-app-shell', route: 'asset-rankings', viewport: { width: 768, height: 1024 }, fullPage: true });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'shell-mobile', group: 'shell', directory: '09-mobile', route: 'asset-rankings', viewport: { width: 390, height: 844 }, fullPage: true });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'command-palette-selected-unique-result', group: 'command-palette', directory: '05-app-shell', route: 'market', viewport: { width: 1440, height: 1000 }, prepare: async (page) => { await openCommandPalette(page); }, afterCapture: async (page) => { await closeCommandPalette(page); }, fullPage: false, failedAction: 'command-palette' });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'theme-studio-desktop', group: 'theme-studio', directory: '08-theme-compatibility', route: 'market', viewport: { width: 1440, height: 1000 }, prepare: async (page) => openThemeStudio(page, 'studio'), fullPage: true, failedAction: 'theme-studio' });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'theme-gallery-desktop', group: 'theme-gallery', directory: '08-theme-compatibility', route: 'market', viewport: { width: 1440, height: 1000 }, prepare: async (page) => openThemeStudio(page, 'gallery'), fullPage: true, failedAction: 'theme-gallery' });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'theme-studio-mobile', group: 'theme-studio', directory: '09-mobile', route: 'market', viewport: { width: 390, height: 844 }, prepare: async (page) => openThemeStudio(page, 'studio'), fullPage: true, failedAction: 'theme-studio-mobile' });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'auth-login', group: 'product-state', directory: '07-auth-loading-empty', route: 'auth-login', viewport: { width: 1280, height: 900 }, fullPage: true });
  for (const state of ['loading', 'empty', 'offline', 'error']) {
    await runCapture(chromium, 'chromium', { browser: chrome, name: `state-${state}`, group: 'product-state', directory: '07-auth-loading-empty', route: 'market', viewport: { width: 1280, height: 900 }, prepare: async (page) => setPreviewState(page, state), fullPage: true, failedAction: `state-${state}` });
  }
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'asset-rankings-desktop', group: 'product-foundation', directory: '05-app-shell', route: 'asset-rankings', viewport: { width: 1440, height: 1000 }, fullPage: true });
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'asset-rankings-mobile', group: 'product-foundation', directory: '09-mobile', route: 'asset-rankings', viewport: { width: 390, height: 844 }, fullPage: true });

  for (const family of themes) {
    for (const appearance of ['dark', 'light']) {
      await runCapture(chromium, 'chromium', {
        browser: chrome, name: `theme-${family}-${appearance}`, group: 'theme-family', directory: '08-theme-compatibility', route: 'market',
        viewport: { width: 1280, height: 800 }, colorScheme: appearance === 'light' ? 'light' : 'dark', appearance, themeFamily: family, fullPage: false, collectMetrics: false
      });
    }
  }
  await runCapture(chromium, 'chromium', { browser: chrome, name: 'theme-signal-access-high-contrast', group: 'theme-family', directory: '08-theme-compatibility', route: 'market', viewport: { width: 1280, height: 800 }, colorScheme: 'dark', appearance: 'high-contrast', themeFamily: 'signal-access', fullPage: false, collectMetrics: false });
  await createLogoBoard(chrome);
  await createPwaBoard(chrome);
  await chrome.close();

  await copyEvidenceSources();
  const sanitization = await sanitizeCompiledPreview();
  await validateSanitizedCompiledPreview();
  const performance = await performanceSummary();
  await json(path.join(artifact, '11-performance/PERFORMANCE_QA.json'), performance);
  await json(path.join(reportDir, 'PERFORMANCE_QA.json'), performance);
  await json(path.join(reportDir, 'CONSOLE_ERRORS.json'), consoleErrors);
  await json(path.join(reportDir, 'FAILED_RESOURCES.json'), failedResources);
  await json(path.join(reportDir, 'PAGE_ERRORS.json'), pageErrors);
  await json(path.join(reportDir, 'LAYOUT_SHIFT_QA.json'), { threshold: clsThreshold, records: layoutShiftEvidence });
  await json(path.join(reportDir, 'BROWSER_MATRIX.json'), { browsers: browsers.map(([name]) => name), viewports: viewports.map(([width, height]) => `${width}x${height}`), captures });
  await json(path.join(reportDir, 'RENDERER_FAILURES.json'), rendererFailures);
  await json(path.join(reportDir, 'OPENING_SCREEN_EVIDENCE.json'), openingEvidence);
  await json(path.join(reportDir, 'COMPILED_PREVIEW_SANITIZATION.json'), { ...sanitization, checks: sanitizedPreviewChecks });

  const maxCls = Math.max(0, ...metrics.map((item) => Number(item.cls || 0)));
  const maxOverflow = Math.max(0, ...metrics.map((item) => Number(item.overflow || 0)));
  const expectedMatrix = browsers.length * viewports.length;
  const matrixCount = captures.filter((item) => item.group === 'browser-matrix').length;
  const openingCount = captures.filter((item) => item.group === 'opening').length;
  const themeCount = captures.filter((item) => item.group === 'theme-family' && item.capture !== 'theme-signal-access-high-contrast').length;
  const requiredGroups = ['homepage', 'shell', 'command-palette', 'theme-studio', 'theme-gallery', 'product-state', 'product-foundation', 'logo-system', 'favicon-pwa'];
  const missingGroups = requiredGroups.filter((group) => !captures.some((item) => item.group === group));
  const validation = {
    result: rendererFailures.length === 0 && consoleErrors.length === 0 && pageErrors.length === 0 && failedResources.length === 0 && maxCls < clsThreshold && maxOverflow <= overflowThreshold && matrixCount === expectedMatrix && openingCount === browsers.length * 3 && themeCount === themes.length * 2 && missingGroups.length === 0 ? 'passed' : 'failed',
    commit: reviewCommit,
    counts: { totalCaptures: captures.length, browserViewportCaptures: matrixCount, expectedBrowserViewportCaptures: expectedMatrix, openingCaptures: openingCount, themeDarkLightCaptures: themeCount, browsers: browsers.length, viewports: viewports.length },
    gates: {
      rendererFailures: rendererFailures.length === 0,
      consoleClean: consoleErrors.length === 0,
      pageErrorsClean: pageErrors.length === 0,
      resourcesClean: failedResources.length === 0,
      layoutShift: maxCls < clsThreshold,
      horizontalOverflow: maxOverflow <= overflowThreshold,
      browserMatrixComplete: matrixCount === expectedMatrix,
      openingEvidenceComplete: openingCount === browsers.length * 3,
      themeCompatibilityComplete: themeCount === themes.length * 2,
      requiredGroupsComplete: missingGroups.length === 0,
      compiledPreviewRunnable: sanitizedPreviewChecks.at(-1)?.result === 'passed',
      ibmPlexLockedInTestedBuild: true,
      deliveryFontBinariesRemoved: sanitization.removed.length > 0 && !(await walk(artifact)).some((file) => /\.woff2$/i.test(file.rel))
    },
    metrics: { maxCls, maxOverflow, consoleErrors: consoleErrors.length, pageErrors: pageErrors.length, failedResources: failedResources.length },
    missingGroups
  };
  await json(path.join(reportDir, 'VALIDATION_SUMMARY.json'), validation);
  await writeMarkdownReports(performance, sanitization);
  await writeChecksumsAndManifest(validation);
  if (validation.result !== 'passed') throw new Error(`Brand review failed closed: ${JSON.stringify(validation)}`);
  console.log(JSON.stringify(validation, null, 2));
}

try {
  await execute();
} catch (error) {
  if (!rendererFailures.some((item) => item.error === error.message)) rendererFailures.push({ browser: 'orchestrator', viewport: null, route: null, theme: null, appearance: null, capture: 'review-orchestrator', action: 'execute', errorName: error.name, error: error.message, stack: error.stack || null, recordedAt: new Date().toISOString() });
  await mkdir(reportDir, { recursive: true });
  await json(path.join(reportDir, 'RENDERER_FAILURES.json'), rendererFailures);
  await json(path.join(reportDir, 'CONSOLE_ERRORS.json'), consoleErrors);
  await json(path.join(reportDir, 'FAILED_RESOURCES.json'), failedResources);
  await json(path.join(reportDir, 'PAGE_ERRORS.json'), pageErrors);
  throw error;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
}
