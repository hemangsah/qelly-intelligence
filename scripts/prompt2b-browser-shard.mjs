import { execFileSync } from 'node:child_process';
import { mkdir, open, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const browserName = process.env.QELLY_BROWSER;
const routeKey = process.env.QELLY_ROUTE;
const exactHead = process.env.QELLY_REVIEW_HEAD ?? process.env.GITHUB_SHA ?? 'unknown';
const branchName = process.env.QELLY_REVIEW_BRANCH ?? 'feature/calculator-and-indicator-foundation';
const outputRoot = path.resolve(process.env.QELLY_SHARD_OUTPUT ?? '.prompt2b-shard');
import { browserTypes, routeCases, viewports, themes, motions, EXPECTED_CASES, savedSeed } from './prompt2b-fasttrack/browser-contract.mjs';
const slugify = value => value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
import { startFrontendServer, twoFrames, waitForRoute, applyThemeAndMotion, performRouteAction, measureNavigationClearance, captureMetrics, captureTruth, shouldCaptureRepresentative, recordFile, sha256 } from './prompt2b-fasttrack/browser-helpers.mjs';

if (!browserTypes[browserName]) throw new Error(`Unsupported QELLY_BROWSER: ${browserName}`);
if (!routeCases.has(routeKey)) throw new Error(`Unsupported QELLY_ROUTE: ${routeKey}`);
if (!/^[0-9a-f]{40}$/.test(exactHead)) throw new Error(`Invalid QELLY_REVIEW_HEAD: ${exactHead}`);
const localHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (localHead !== exactHead) throw new Error(`Exact-head guard failed before shard: ${localHead} != ${exactHead}`);

const shardSlug = `${browserName}--${routeKey}`;
const output = path.join(outputRoot, shardSlug);
const screenshotsDir = path.join(output, 'screenshots');
const tracesDir = path.join(output, 'traces');
await mkdir(screenshotsDir, { recursive: true });
await mkdir(tracesDir, { recursive: true });
const jsonlPath = path.join(output, 'CASES.jsonl');
const jsonl = await open(jsonlPath, 'w');
const records = [];
const screenshotManifest = [];
const traceManifest = [];
const startedAt = new Date().toISOString();
let fatalError = null;

const { server, base } = await startFrontendServer();
const appendRecord = async record => {
  records.push(record);
  await jsonl.write(`${JSON.stringify(record)}\n`);
  await jsonl.sync();
};

let browser = null;
try {
  browser = await browserTypes[browserName].launch({ headless: true });
  for (const [width, height] of viewports) {
    for (const theme of themes) {
      for (const motion of motions) {
        const caseStarted = new Date().toISOString();
        const caseTimer = performance.now();
        const caseId = `${browserName}|${routeKey}|${width}x${height}|${theme.label}|${motion}`;
        const safeCase = slugify(caseId);
        let context = null;
        let page = null;
        let tracingStarted = false;
        let traceSaved = false;
        const consoleErrors = [], pageErrors = [], failedResources = [], reasons = [], exceptions = [];
        let actionEvidence = null, navClearance = null, metrics = null, truth = false, loadMs = null;
        try {
          context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference', colorScheme: theme.colorScheme, acceptDownloads: true });
          await context.addInitScript(seed => {
            sessionStorage.setItem('qelly.brand.opening.v1', 'seen');
            localStorage.setItem('qelly.calculations.v1', JSON.stringify(seed));
            window.__qellyCLS = 0;
            if ('PerformanceObserver' in window) {
              try { new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__qellyCLS += entry.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
            }
          }, savedSeed);
          await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
          tracingStarted = true;
          page = await context.newPage();
          page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
          page.on('pageerror', error => pageErrors.push(error.message));
          page.on('requestfailed', request => { if (request.url().startsWith('http://127.0.0.1')) failedResources.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }); });
          const navigationStarted = performance.now();
          await page.goto(`${base}#/${routeCases.get(routeKey).hash}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await waitForRoute(page);
          await applyThemeAndMotion(page, theme, motion);
          actionEvidence = await performRouteAction(page, routeKey);
          await twoFrames(page);
          navClearance = await measureNavigationClearance(page);
          loadMs = performance.now() - navigationStarted;
          metrics = await captureMetrics(page);
          truth = await captureTruth(page, routeKey);
          if (metrics.textLength < 60) reasons.push('empty-content');
          if (metrics.overflowX > 1) reasons.push(`horizontal-overflow:${metrics.overflowX}`);
          if (metrics.fontStatus !== 'loaded') reasons.push(`font:${metrics.fontStatus}`);
          if (!metrics.logo) reasons.push('logo-missing');
          if (metrics.theme !== theme.persona || metrics.persona !== theme.persona) reasons.push(`theme-not-applied:${metrics.theme}/${metrics.persona}`);
          if (metrics.motion !== motion) reasons.push(`motion-not-applied:${metrics.motion}`);
          if (metrics.unlabeledControls > 0) reasons.push(`unlabeled-controls:${metrics.unlabeledControls}`);
          if (navClearance.supported && (navClearance.obscured > 0 || navClearance.clearance < -1 || navClearance.focusClearance < -1)) reasons.push('fixed-nav-clearance');
          if (metrics.cls > 0.1) reasons.push(`cls:${metrics.cls}`);
          if (metrics.excessTrailingSpace > height) reasons.push(`blank-tail:${metrics.excessTrailingSpace}`);
          if (loadMs > 15000) reasons.push(`route-load-ms:${loadMs.toFixed(1)}`);
          if (!truth) reasons.push('truth-boundary');
          if (consoleErrors.length) reasons.push(`console-errors:${consoleErrors.length}`);
          if (pageErrors.length) reasons.push(`page-errors:${pageErrors.length}`);
          if (failedResources.length) reasons.push(`failed-local-resources:${failedResources.length}`);
        } catch (error) {
          exceptions.push({ name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null });
          reasons.push(`case-exception:${error?.name ?? 'Error'}`);
        }
        const uniqueReasons = [...new Set(reasons)].sort();
        const failureSignature = uniqueReasons.length ? sha256(Buffer.from(JSON.stringify({ reasons: uniqueReasons, exceptions: exceptions.map(item => ({ name: item.name, message: item.message })) }))) : null;
        const screenshotNeeded = uniqueReasons.length > 0 || shouldCaptureRepresentative(width, theme.label, motion);
        if (screenshotNeeded && page) {
          const file = path.join(screenshotsDir, `${safeCase}.png`);
          try {
            await page.screenshot({ path: file, fullPage: false });
            await recordFile(screenshotManifest, 'screenshot', file, { caseId, failure: uniqueReasons.length > 0, failureSignature });
          } catch (error) {
            exceptions.push({ name: error?.name ?? 'ScreenshotError', message: error?.message ?? String(error) });
            uniqueReasons.push('screenshot-capture-failed');
          }
        }
        if (tracingStarted && context) {
          try {
            if (uniqueReasons.length > 0) {
              const file = path.join(tracesDir, `${safeCase}.zip`);
              await context.tracing.stop({ path: file });
              traceSaved = true;
              await recordFile(traceManifest, 'trace', file, { caseId, failureSignature });
            } else {
              await context.tracing.stop();
            }
          } catch (error) {
            exceptions.push({ name: error?.name ?? 'TraceError', message: error?.message ?? String(error) });
            uniqueReasons.push('trace-capture-failed');
          }
        }
        const completedAt = new Date().toISOString();
        const record = {
          schemaVersion: 1,
          repository: 'hemangsah/qelly-intelligence',
          head: exactHead,
          branch: branchName,
          shard: shardSlug,
          caseId,
          attempt: 1,
          retries: 0,
          forcedClicks: 0,
          browser: browserName,
          route: routeKey,
          hash: routeCases.get(routeKey).hash,
          viewport: { width, height },
          appearance: theme.label,
          persona: theme.persona,
          motion,
          startedAt: caseStarted,
          completedAt,
          durationMs: Number((performance.now() - caseTimer).toFixed(2)),
          loadMs: loadMs == null ? null : Number(loadMs.toFixed(2)),
          status: uniqueReasons.length ? 'failed' : 'passed',
          reasons: [...new Set(uniqueReasons)].sort(),
          failureSignature,
          truth,
          metrics,
          navClearance,
          actionEvidence,
          consoleErrors,
          pageErrors,
          failedResources,
          exceptions,
          screenshotCaptured: screenshotNeeded,
          traceCaptured: traceSaved
        };
        await appendRecord(record);
        await page?.close().catch(() => {});
        await context?.close().catch(() => {});
      }
    }
  }
} catch (error) {
  fatalError = { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack ?? null };
} finally {
  await browser?.close().catch(() => {});
  await new Promise(resolve => server.close(resolve));
  await jsonl.close();
}

const uniqueCaseIds = new Set(records.map(item => item.caseId));
const failed = records.filter(item => item.status === 'failed');
const counterReconciliation = {
  schemaVersion: 1,
  head: exactHead,
  shard: shardSlug,
  expected: EXPECTED_CASES,
  attempted: records.length,
  durableJsonlRecords: records.length,
  uniqueCaseIds: uniqueCaseIds.size,
  duplicates: records.length - uniqueCaseIds.size,
  passed: records.length - failed.length,
  failed: failed.length,
  retries: records.reduce((sum, item) => sum + item.retries, 0),
  forcedClicks: records.reduce((sum, item) => sum + item.forcedClicks, 0),
  denominatorMatched: records.length === EXPECTED_CASES && uniqueCaseIds.size === EXPECTED_CASES,
  fatalError
};
const failureSignatures = failed.map(item => ({ caseId: item.caseId, signature: item.failureSignature, reasons: item.reasons, exceptions: item.exceptions }));
const summary = {
  schemaVersion: 1,
  repository: 'hemangsah/qelly-intelligence',
  head: exactHead,
  branch: branchName,
  shard: shardSlug,
  browser: browserName,
  route: routeKey,
  expectedCases: EXPECTED_CASES,
  records: records.length,
  passed: records.length - failed.length,
  failed: failed.length,
  startedAt,
  completedAt: new Date().toISOString(),
  failFast: false,
  retries: 0,
  forcedClicks: 0,
  fatalError,
  jsonl: 'CASES.jsonl',
  screenshots: screenshotManifest.length,
  traces: traceManifest.length,
  denominatorMatched: counterReconciliation.denominatorMatched
};
await writeFile(path.join(output, 'SHARD_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(path.join(output, 'COUNTER_RECONCILIATION.json'), `${JSON.stringify(counterReconciliation, null, 2)}\n`);
await writeFile(path.join(output, 'FAILURE_SIGNATURES.json'), `${JSON.stringify({ schemaVersion: 1, head: exactHead, shard: shardSlug, count: failureSignatures.length, failures: failureSignatures }, null, 2)}\n`);
await writeFile(path.join(output, 'SCREENSHOT_MANIFEST.json'), `${JSON.stringify({ schemaVersion: 1, head: exactHead, shard: shardSlug, files: screenshotManifest }, null, 2)}\n`);
await writeFile(path.join(output, 'TRACE_MANIFEST.json'), `${JSON.stringify({ schemaVersion: 1, head: exactHead, shard: shardSlug, files: traceManifest }, null, 2)}\n`);
if (fatalError) await writeFile(path.join(output, 'SHARD_FATAL.json'), `${JSON.stringify({ schemaVersion: 1, head: exactHead, shard: shardSlug, fatalError }, null, 2)}\n`);

const walk = async directory => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
};
const checksumFiles = (await walk(output)).filter(file => !file.endsWith('CHECKSUMS.json')).sort();
const checksums = [];
for (const file of checksumFiles) {
  const body = await readFile(file);
  checksums.push({ path: path.relative(output, file).replaceAll('\\', '/'), bytes: (await stat(file)).size, sha256: sha256(body) });
}
await writeFile(path.join(output, 'CHECKSUMS.json'), `${JSON.stringify({ schemaVersion: 1, head: exactHead, shard: shardSlug, fileCount: checksums.length, files: checksums }, null, 2)}\n`);

const endHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (endHead !== exactHead) throw new Error(`Exact-head guard failed after shard: ${endHead} != ${exactHead}`);
console.log(JSON.stringify(summary, null, 2));
if (fatalError || !counterReconciliation.denominatorMatched || failed.length) process.exit(1);
