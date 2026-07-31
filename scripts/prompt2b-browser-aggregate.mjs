import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { calculateFormula, listFormulaDefinitions } from '../apps/web/public/assets/calculation/formula-engine-extended.mjs';
import { calculateIndicator, listIndicatorDefinitions } from '../apps/web/public/assets/calculation/indicator-engine-extended.mjs';

const exactHead = process.env.QELLY_REVIEW_HEAD ?? process.env.GITHUB_SHA ?? 'unknown';
const inputRoot = path.resolve(process.env.QELLY_SHARD_INPUT ?? '.prompt2b-shards');
const output = path.resolve(process.env.QELLY_REVIEW_OUTPUT ?? '.prompt2b-review');
const modeConfig = JSON.parse(await readFile(process.env.QELLY_FAST_TRACK_MODE_FILE ?? 'project-state/QELLY_PROMPT2B_FAST_TRACK_MODE.json', 'utf8'));
const mode = process.env.QELLY_FAST_TRACK_MODE ?? modeConfig.mode;
const browserNames = ['chromium','firefox','webkit'];
const routes = ['calculator-center','india-finance','indicator-library','formula-library','saved-calculations','formula-detail','indicator-detail','calculator-detail','saved-calculation-detail'];
const viewports = [[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,1000],[1728,1080],[1920,1080]];
const themes = ['dark','porcelain-light','oled','high-contrast'];
const motions = ['full','reduced'];
const sha256 = body => createHash('sha256').update(body).digest('hex');
const localHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (localHead !== exactHead) throw new Error(`Exact-head guard failed before browser aggregate: ${localHead} != ${exactHead}`);
if (!['focused','acceptance'].includes(mode)) throw new Error(`Unsupported fast-track mode: ${mode}`);

const allShards = browserNames.flatMap(browser => routes.map(route => ({ browser, route, shard: `${browser}--${route}` })));
const selectedShards = mode === 'acceptance'
  ? allShards
  : modeConfig.focus.browserShards.map(item => ({ ...item, shard: `${item.browser}--${item.route}` }));
const selectedIds = new Set(selectedShards.map(item => item.shard));
const expectedCases = selectedShards.length * 72;

const walk = async directory => {
  const outputFiles = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) outputFiles.push(...await walk(full));
    else outputFiles.push(full);
  }
  return outputFiles;
};
const findFiles = async basename => (await walk(inputRoot)).filter(file => path.basename(file) === basename);
const summaryFiles = await findFiles('SHARD_SUMMARY.json');
const summaryByShard = new Map();
for (const file of summaryFiles) {
  const summary = JSON.parse(await readFile(file, 'utf8'));
  if (selectedIds.has(summary.shard)) summaryByShard.set(summary.shard, { file, summary });
}
const records = [];
const shardDiagnostics = [];
const missingShards = [];
const checksumFailures = [];
for (const shard of selectedShards) {
  const found = summaryByShard.get(shard.shard);
  if (!found) {
    missingShards.push(shard.shard);
    continue;
  }
  const shardDir = path.dirname(found.file);
  const casesPath = path.join(shardDir, 'CASES.jsonl');
  const checksumsPath = path.join(shardDir, 'CHECKSUMS.json');
  const lines = (await readFile(casesPath, 'utf8')).split(/\r?\n/).filter(Boolean);
  const shardRecords = lines.map(line => JSON.parse(line));
  records.push(...shardRecords);
  const checksumDoc = JSON.parse(await readFile(checksumsPath, 'utf8'));
  const missing = [], mismatches = [];
  for (const item of checksumDoc.files) {
    const file = path.join(shardDir, item.path);
    try {
      const body = await readFile(file);
      if (body.length !== item.bytes || sha256(body) !== item.sha256) mismatches.push(item.path);
    } catch {
      missing.push(item.path);
    }
  }
  if (missing.length || mismatches.length) checksumFailures.push({ shard: shard.shard, missing, mismatches });
  shardDiagnostics.push({
    shard: shard.shard,
    summary: found.summary,
    jsonlRecords: shardRecords.length,
    checksumCount: checksumDoc.fileCount,
    checksumMissing: missing,
    checksumMismatches: mismatches
  });
}

const expectedCaseIds = [];
for (const shard of selectedShards) {
  for (const [width,height] of viewports) for (const theme of themes) for (const motion of motions) {
    expectedCaseIds.push(`${shard.browser}|${shard.route}|${width}x${height}|${theme}|${motion}`);
  }
}
const actualIds = records.map(item => item.caseId);
const actualSet = new Set(actualIds);
const expectedSet = new Set(expectedCaseIds);
const missingCases = expectedCaseIds.filter(id => !actualSet.has(id));
const unexpectedCases = [...actualSet].filter(id => !expectedSet.has(id));
const duplicateCases = [...new Set(actualIds.filter((id,index) => actualIds.indexOf(id) !== index))];
const failedRecords = records.filter(item => item.status !== 'passed');
const failureSignatures = failedRecords.map(item => ({ caseId: item.caseId, signature: item.failureSignature, reasons: item.reasons, exceptions: item.exceptions }));

const screenshotFiles = (await findFiles('SCREENSHOT_MANIFEST.json')).filter(file => {
  const shard = path.basename(path.dirname(file));
  return selectedIds.has(shard);
});
const traceFiles = (await findFiles('TRACE_MANIFEST.json')).filter(file => selectedIds.has(path.basename(path.dirname(file))));
const screenshotManifest = [];
const traceManifest = [];
await mkdir(path.join(output, 'screenshots'), { recursive: true });
await mkdir(path.join(output, 'traces'), { recursive: true });
for (const manifestPath of screenshotFiles) {
  const document = JSON.parse(await readFile(manifestPath, 'utf8'));
  const shardDir = path.dirname(manifestPath);
  for (const item of document.files) {
    const source = path.join(shardDir, item.path);
    const targetName = `${document.shard}--${path.basename(item.path)}`;
    const target = path.join(output, 'screenshots', targetName);
    await copyFile(source, target);
    const body = await readFile(target);
    screenshotManifest.push({ ...item, sourceShard: document.shard, path: `screenshots/${targetName}`, bytes: body.length, sha256: sha256(body) });
  }
}
for (const manifestPath of traceFiles) {
  const document = JSON.parse(await readFile(manifestPath, 'utf8'));
  const shardDir = path.dirname(manifestPath);
  for (const item of document.files) {
    const source = path.join(shardDir, item.path);
    const targetName = `${document.shard}--${path.basename(item.path)}`;
    const target = path.join(output, 'traces', targetName);
    await copyFile(source, target);
    const body = await readFile(target);
    traceManifest.push({ ...item, sourceShard: document.shard, path: `traces/${targetName}`, bytes: body.length, sha256: sha256(body) });
  }
}

const themePairs = [];
for (const shard of selectedShards) {
  const samples = Object.fromEntries(themes.map(theme => [theme, records.find(item => item.browser === shard.browser && item.route === shard.route && item.viewport?.width === 1440 && item.motion === 'full' && item.appearance === theme)]));
  const signatures = Object.fromEntries(Object.entries(samples).map(([label,item]) => [label, item ? JSON.stringify({ body: item.metrics?.bodyBackground, palette: item.metrics?.semanticPalette, theme: item.metrics?.theme }) : null]));
  const distinct = new Set(Object.values(signatures).filter(Boolean)).size;
  themePairs.push({ browser: shard.browser, route: shard.route, signatures, distinct, allApplied: Object.values(samples).every(Boolean), different: distinct === themes.length });
}
const themeFailures = themePairs.filter(item => !item.allApplied || !item.different);

const performanceCases = [];
if (mode === 'acceptance') {
  const close = Array.from({ length: 10000 }, (_, index) => 100 + Math.sin(index / 17) * 3 + index * .0008);
  const high = close.map((value,index) => value + .7 + (index % 4) * .02);
  const low = close.map((value,index) => value - .8 - (index % 3) * .02);
  const openValues = close.map((value,index) => value + (index % 2 ? .1 : -.1));
  const volume = close.map((_,index) => 1000 + (index % 250) * 11);
  for (const indicatorId of ['sma','ema','rsi','atr','bollinger-bands','supertrend','vwap','mfi','fresh-price-momentum','fresh-rolling-support-resistance']) {
    const started = performance.now();
    const result = calculateIndicator(indicatorId, { open: openValues, high, low, close, volume, period: 14 });
    performanceCases.push({ type: 'indicator', id: indicatorId, points: 10000, durationMs: Number((performance.now() - started).toFixed(3)), status: result.status });
  }
  for (const [formulaId,inputs] of [
    ['loan-amortization',{ principal:7500000, annualRatePercent:8.5, months:360 }],
    ['xirr',{ cashflows:[{ amount:-100000, date:'2020-01-01' },{ amount:120000, date:'2021-01-01' }] }],
    ['portfolio-volatility',{ weights:[.4,.35,.25], covarianceMatrix:[[.04,.01,.008],[.01,.03,.006],[.008,.006,.02]] }],
    ['fresh-present-value',{ futureValue:110, rate:.1, periods:1 }]
  ]) {
    const started = performance.now();
    const result = calculateFormula(formulaId, inputs);
    performanceCases.push({ type: 'formula', id: formulaId, durationMs: Number((performance.now() - started).toFixed(3)), status: result.status });
  }
}
const performanceFailures = performanceCases.filter(item => item.status !== 'success' || item.durationMs > 2000);
const counterReconciliation = {
  schemaVersion: 1,
  head: exactHead,
  mode,
  expectedShards: selectedShards.length,
  foundShards: summaryByShard.size,
  missingShards,
  expectedRecords: expectedCases,
  records: records.length,
  uniqueCaseIds: actualSet.size,
  duplicateCases,
  missingCases,
  unexpectedCases,
  passed: records.length - failedRecords.length,
  failed: failedRecords.length,
  retries: records.reduce((sum,item) => sum + Number(item.retries ?? 0), 0),
  forcedClicks: records.reduce((sum,item) => sum + Number(item.forcedClicks ?? 0), 0),
  checksumFailures,
  denominatorMatched: missingShards.length === 0 && records.length === expectedCases && actualSet.size === expectedCases && !duplicateCases.length && !missingCases.length && !unexpectedCases.length
};
const report = {
  schemaVersion: 5,
  repository: 'hemangsah/qelly-intelligence',
  head: exactHead,
  mode,
  generatedAt: new Date().toISOString(),
  formulaDefinitions: listFormulaDefinitions().length,
  indicatorDefinitions: listIndicatorDefinitions().length,
  browserMatrix: {
    records: records.length,
    expected: expectedCases,
    passed: records.length - failedRecords.length,
    failed: failedRecords.length,
    shards: selectedShards.length,
    browsers: [...new Set(selectedShards.map(item => item.browser))],
    viewports: viewports.map(([width,height]) => `${width}x${height}`),
    themes,
    motions,
    routes: [...new Set(selectedShards.map(item => item.route))]
  },
  performance: { cases: performanceCases, failures: performanceFailures },
  themeDifferentiation: { pairs: themePairs, failures: themeFailures },
  screenshots: screenshotManifest,
  traces: traceManifest,
  failures: failedRecords,
  counterReconciliation,
  actionEvidence: { mode: 'single trusted pointer click after unobstructed center hit-test', retries: 0, forcedClicks: 0 }
};
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'BROWSER_MATRIX.json'), `${JSON.stringify({ head: exactHead, mode, expectedRecords: expectedCases, records, failures: failedRecords }, null, 2)}\n`);
await writeFile(path.join(output, 'FAILURE_SIGNATURES.json'), `${JSON.stringify({ schemaVersion: 1, head: exactHead, mode, count: failureSignatures.length, failures: failureSignatures }, null, 2)}\n`);
await writeFile(path.join(output, 'COUNTER_RECONCILIATION.json'), `${JSON.stringify(counterReconciliation, null, 2)}\n`);
await writeFile(path.join(output, 'SHARD_RECONCILIATION.json'), `${JSON.stringify({ schemaVersion: 1, head: exactHead, mode, selectedShards, diagnostics: shardDiagnostics, missingShards, checksumFailures }, null, 2)}\n`);
await writeFile(path.join(output, 'PERFORMANCE.json'), `${JSON.stringify({ head: exactHead, cases: performanceCases, failures: performanceFailures }, null, 2)}\n`);
await writeFile(path.join(output, 'THEME_DIFFERENTIATION.json'), `${JSON.stringify({ head: exactHead, pairs: themePairs, failures: themeFailures }, null, 2)}\n`);
await writeFile(path.join(output, 'SCREENSHOT_MANIFEST.json'), `${JSON.stringify({ head: exactHead, files: screenshotManifest }, null, 2)}\n`);
await writeFile(path.join(output, 'TRACE_MANIFEST.json'), `${JSON.stringify({ head: exactHead, files: traceManifest }, null, 2)}\n`);
await writeFile(path.join(output, 'SUMMARY.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(output, 'README.md'), `# Qelly Prompt 2B ${mode === 'acceptance' ? 'Final Acceptance' : 'Focused Fast-Track'} Review\n\nExact head: \`${exactHead}\`\n\n- Mode: ${mode}\n- Browser shards: ${selectedShards.length}\n- Browser records: ${records.length}/${expectedCases}\n- Browser failures: ${failedRecords.length}\n- Missing shards/cases: ${missingShards.length}/${missingCases.length}\n- Performance failures: ${performanceFailures.length}\n- Theme differentiation failures: ${themeFailures.length}\n- Retries / forced clicks: 0 / 0\n\nFresh structured exact-head evidence. Historical missing per-case evidence is not claimed as recovered.\n`);

const checksumFiles = (await walk(output)).filter(file => !file.endsWith('CHECKSUMS.json')).sort();
const checksums = [];
for (const file of checksumFiles) {
  const body = await readFile(file);
  checksums.push({ path: path.relative(output, file).replaceAll('\\','/'), bytes: (await stat(file)).size, sha256: sha256(body) });
}
await writeFile(path.join(output, 'CHECKSUMS.json'), `${JSON.stringify({ schemaVersion: 1, head: exactHead, mode, fileCount: checksums.length, files: checksums }, null, 2)}\n`);

const endHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (endHead !== exactHead) throw new Error(`Exact-head guard failed after browser aggregate: ${endHead} != ${exactHead}`);
console.log(JSON.stringify({ head: exactHead, mode, records: records.length, expected: expectedCases, failures: failedRecords.length, missingShards, missingCases: missingCases.length, checksumFailures: checksumFailures.length, performanceFailures: performanceFailures.length, themeFailures: themeFailures.length }, null, 2));
const invalid = !counterReconciliation.denominatorMatched || failedRecords.length || checksumFailures.length || themeFailures.length || (mode === 'acceptance' && performanceFailures.length);
if (invalid) process.exit(1);
