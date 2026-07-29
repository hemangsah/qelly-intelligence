import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const root = process.cwd();
const dist = path.join(root, 'dist', 'frontend');
const out = path.join(root, '.prompt2a-final', '03-frontend');
await mkdir(out, { recursive: true });

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((candidate) => candidate.some(Boolean))
    .map((candidate) => Object.fromEntries(headers.map((header, index) => [header, candidate[index] ?? ''])));
}

const routes = parseCsv(
  await readFile(path.join(root, 'project-state', 'QELLY_ROUTE_STATUS.csv'), 'utf8')
);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let relative = decodeURIComponent(url.pathname).replace(/^\/qelly-intelligence\/?/, '');
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const filePath = path.join(dist, relative);

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        'content-type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      response.end(body);
    } catch {
      const body = await readFile(path.join(dist, 'index.html'));
      response.writeHead(200, {
        'content-type': 'text/html',
        'cache-control': 'no-store'
      });
      response.end(body);
    }
  } catch (error) {
    response.writeHead(500);
    response.end(error.message);
  }
});

await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));

const browserConfigurations = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit]
];
const viewports = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 }
];
const records = [];

for (const [browserName, browserType] of browserConfigurations) {
  const browser = await browserType.launch({ headless: true });

  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const localFailed = [];
    const externalFailed = [];

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      const item = { url: request.url(), error: request.failure()?.errorText };
      if (item.url.startsWith('http://127.0.0.1')) localFailed.push(item);
      else externalFailed.push(item);
    });

    for (const route of routes) {
      consoleErrors.length = 0;
      pageErrors.length = 0;
      localFailed.length = 0;
      externalFailed.length = 0;

      const routeKey = (route.route || '').replace(/^#\/?/, '');
      const target = `http://127.0.0.1:4173/qelly-intelligence/#/${routeKey}`;
      let navigationError = null;

      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForSelector('#main', { timeout: 15_000 });
        await page.waitForTimeout(80);
      } catch (error) {
        navigationError = error.message;
      }

      const measurements = await page.evaluate((requested) => {
        const html = document.documentElement;
        const body = document.body;
        const main = document.querySelector('#main');
        const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
        const buttons = [...document.querySelectorAll('button')];
        const visible = [...document.querySelectorAll('#main *')].filter((element) => {
          const style = getComputedStyle(element);
          const rectangle = element.getBoundingClientRect();
          return style.display !== 'none'
            && style.visibility !== 'hidden'
            && Number(style.opacity) !== 0
            && rectangle.width > 0
            && rectangle.height > 0;
        });
        const renderedText = (main?.innerText || '').trim();
        const semanticText = (main?.textContent || '').trim();

        return {
          requested,
          hash: location.hash,
          title: (main?.querySelector('h1,h2')?.textContent || '').trim(),
          innerTextLength: renderedText.length,
          textContentLength: semanticText.length,
          mainTextLength: Math.max(renderedText.length, semanticText.length),
          horizontalOverflow: Math.max(
            0,
            html.scrollWidth - html.clientWidth,
            body?.scrollWidth - html.clientWidth || 0
          ),
          scrollHeight: Math.max(html.scrollHeight, body?.scrollHeight || 0),
          lastMeaningfulBottom: Math.round(
            Math.max(0, ...visible.map((element) => element.getBoundingClientRect().bottom + scrollY))
          ),
          duplicateIds: ids.length - new Set(ids).size,
          unnamedButtons: buttons.filter((button) => !(
            (button.getAttribute('aria-label') || button.textContent || '').trim()
          )).length,
          fontReady: document.fonts?.status || null,
          appearance: html.dataset.resolvedAppearance || html.dataset.appearance || null
        };
      }, route.route);

      const hardFailure = Boolean(navigationError)
        || measurements.mainTextLength === 0
        || measurements.horizontalOverflow > 1
        || measurements.duplicateIds > 0
        || consoleErrors.length > 0
        || pageErrors.length > 0
        || localFailed.length > 0;

      records.push({
        browser: browserName,
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        route: route.route,
        registered: route.registered,
        expectedClassification: route.status,
        navigationError,
        ...measurements,
        consoleErrors: [...consoleErrors],
        pageErrors: [...pageErrors],
        failedLocalResources: [...localFailed],
        failedExternalResources: [...externalFailed],
        result: hardFailure ? 'failed' : 'passed'
      });
    }

    await context.close();
  }

  await browser.close();
}

server.close();

const failures = records.filter((record) => record.result !== 'passed');
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  head: process.env.QELLY_AUDIT_HEAD || 'local',
  browserCount: 3,
  viewportCount: 3,
  routeCount: routes.length,
  recordCount: records.length,
  passed: records.length - failures.length,
  failed: failures.length,
  externalResourceFailureRecords: records.filter((record) => record.failedExternalResources.length).length,
  note: 'Static preview may redirect backend-only routes to a truthful fallback. Successful rendering is not connected-feature evidence. WebKit may report empty innerText for display-contents layouts, so visible #main text uses textContent as a standards-safe fallback. External embed/provider failures are recorded separately and require fallback evidence.',
  records
};

await writeFile(
  path.join(out, 'ROUTE_BROWSER_MATRIX.json'),
  `${JSON.stringify(report, null, 2)}\n`
);
await writeFile(
  path.join(out, 'ROUTE_BROWSER_FAILURES.json'),
  `${JSON.stringify(failures, null, 2)}\n`
);
console.log(JSON.stringify({ ...report, records: undefined }, null, 2));

if (failures.length) process.exit(1);
