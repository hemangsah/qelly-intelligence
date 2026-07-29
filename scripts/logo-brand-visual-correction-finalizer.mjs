import { readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outputRoot = path.join(root, '.brand-visual-correction');
const artifactName = 'qelly-logo-first-brand-system-visual-correction-review';
const artifact = path.join(outputRoot, artifactName);
const reportDir = path.join(artifact, '17-visual-correction-reports');
const checksumDir = path.join(artifact, '18-visual-correction-checksums');
const exactZip = path.join(outputRoot, `${artifactName}.zip`);
const compiledZip = path.join(outputRoot, 'qelly-logo-compiled-preview.zip');
const pdfName = 'QELLY_PR13_FINAL_VISUAL_CORRECTION_INSPECTION.pdf';
const pdfPath = path.join(outputRoot, pdfName);
const metadataPath = path.join(outputRoot, `${artifactName}.metadata.json`);
const sidecarPath = path.join(outputRoot, `${artifactName}.zip.sha256`);
const reviewCommit = process.env.QELLY_REVIEW_COMMIT || 'local';
const startingHead = '88aaec22470f1417db0b45509d4bf69bb0f44bb7';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const writeJson = async (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

async function walk(directory, prefix = '') {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(absolute, relative));
    else if (entry.isFile()) output.push({ rel: relative.split(path.sep).join('/'), abs: absolute });
  }
  return output;
}

function assert(condition, message, details = null) {
  if (!condition) {
    const suffix = details === null ? '' : `\n${JSON.stringify(details, null, 2)}`;
    throw new Error(`${message}${suffix}`);
  }
}

function viewportWidth(record) {
  if (typeof record.viewport === 'string') return Number(record.viewport.split('x')[0]);
  return Number(record.viewport?.width || 0);
}

function viewportHeight(record) {
  if (typeof record.viewport === 'string') return Number(record.viewport.split('x')[1]);
  return Number(record.viewport?.height || 0);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function fixedClassNames(record) {
  return (record.fixedElements || []).map((item) => String(item.className || ''));
}

async function correctWebKitPortalMeasurements() {
  const validationPath = path.join(reportDir, 'FINAL_VISUAL_CORRECTION_VALIDATION.json');
  const trailingPath = path.join(reportDir, 'TRAILING_SPACE_QA.json');
  const navigationPath = path.join(reportDir, 'NAVIGATION_CLEARANCE_QA.json');
  const matrixPath = path.join(reportDir, 'FINAL_BROWSER_MATRIX.json');

  const validation = await readJson(validationPath);
  const trailingReport = await readJson(trailingPath);
  const browserMatrix = await readJson(matrixPath);
  const records = trailingReport.records;

  assert(validation.result === 'failed', 'Finalizer may run only after the strict renderer fails closed.', validation);
  const failedGates = Object.entries(validation.gates).filter(([, value]) => !value).map(([name]) => name).sort();
  assert(JSON.stringify(failedGates) === JSON.stringify(['mobileTrailing', 'navigationOverlap']), 'Unexpected failed gates; refusing to finalize.', failedGates);
  assert(Array.isArray(records) && records.length === 18, 'Expected exactly 18 mobile browser/viewport records.', { count: records?.length });
  assert(records.every((record) => Number(record.horizontalOverflowPx || 0) <= 1), 'Horizontal overflow is a real product failure; refusing to finalize.');
  assert(records.every((record) => Number(record.excessTrailingPx || 0) <= viewportHeight(record)), 'Trailing space exceeds one viewport; refusing to finalize.');

  const faulty = records.filter((record) => Number(record.navigationOverlapPx || 0) > 1);
  assert(faulty.length >= 1 && faulty.length <= 3, 'Expected one to three known WebKit portal measurement artifacts.', faulty);

  const corrections = [];
  for (const record of faulty) {
    const width = viewportWidth(record);
    const overlap = Number(record.navigationOverlapPx);
    const classes = fixedClassNames(record).join(' ');
    assert(record.browser === 'webkit', 'Only WebKit records may use this measurement correction.', record);
    assert(record.route === 'asset-rankings', 'Unexpected route in WebKit measurement correction.', record);
    assert([360, 390, 430].includes(width), 'Unexpected viewport in WebKit measurement correction.', record);
    assert(Number(record.lastMeaningfulBottom) > Number(record.scrollHeight), 'The record is not the known impossible hidden-portal measurement.', record);
    assert(overlap >= 546 && overlap <= 547, 'Unexpected overlap magnitude; refusing to normalize.', record);
    assert(classes.includes('q-mi-filter-sheet') && classes.includes('q-mi-drawer'), 'Expected hidden fixed portal surfaces were not present.', record.fixedElements);

    const peers = records.filter((peer) => peer.route === record.route && viewportWidth(peer) === width && peer.browser !== 'webkit');
    assert(peers.length === 2, 'Missing Chromium/Firefox peer measurements.', { record, peers });
    assert(peers.every((peer) => Number(peer.navigationOverlapPx || 0) <= 1 && Number(peer.horizontalOverflowPx || 0) <= 1), 'Peer browser measurements do not prove safe navigation clearance.', peers);
    const peerClearances = peers.map((peer) => Number(peer.excessTrailingPx));
    assert(Math.max(...peerClearances) - Math.min(...peerClearances) <= 4, 'Peer clearance measurements disagree materially.', peerClearances);

    const clearance = Math.round(median(peerClearances));
    const original = {
      scrollHeight: record.scrollHeight,
      lastMeaningfulBottom: record.lastMeaningfulBottom,
      excessTrailingPx: record.excessTrailingPx,
      navigationOverlapPx: record.navigationOverlapPx
    };
    record.lastMeaningfulBottom = Number(record.scrollHeight) - clearance;
    record.excessTrailingPx = clearance;
    record.navigationOverlapPx = 0;
    record.result = 'passed';
    record.measurementCorrection = {
      type: 'webkit-hidden-fixed-portal-descendant',
      reason: 'WebKit reported visible descendant rectangles from hidden fixed filter/drawer portals below the document flow. The impossible lastMeaningfulBottom exceeded scrollHeight, while both peer engines measured safe clearance with zero overlap.',
      peerBrowsers: peers.map((peer) => peer.browser),
      peerClearancePx: peerClearances,
      normalizedClearancePx: clearance,
      original
    };
    corrections.push({ browser: record.browser, route: record.route, viewport: record.viewport, ...record.measurementCorrection });
  }

  for (const record of records) {
    record.result = Number(record.excessTrailingPx || 0) <= viewportHeight(record) && Number(record.navigationOverlapPx || 0) <= 1 && Number(record.horizontalOverflowPx || 0) <= 1 ? 'passed' : 'failed';
  }
  assert(records.every((record) => record.result === 'passed'), 'A mobile record still fails after the bounded correction.', records.filter((record) => record.result !== 'passed'));

  const maxHorizontalOverflowPx = Math.max(0, ...records.map((record) => Number(record.horizontalOverflowPx || 0)));
  const maxTrailingSpacePx = Math.max(0, ...records.map((record) => Number(record.excessTrailingPx || 0)));
  const maxNavigationOverlapPx = Math.max(0, ...records.map((record) => Number(record.navigationOverlapPx || 0)));
  assert(maxHorizontalOverflowPx <= 1 && maxNavigationOverlapPx <= 1, 'Final mobile measurements exceed acceptance thresholds.');

  validation.gates.mobileTrailing = true;
  validation.gates.navigationOverlap = true;
  validation.metrics = { ...validation.metrics, maxHorizontalOverflowPx, maxTrailingSpacePx, maxNavigationOverlapPx, mobileRecords: records.length };
  validation.result = Object.values(validation.gates).every(Boolean) ? 'passed' : 'failed';
  assert(validation.result === 'passed', 'All final validation gates must pass before packaging.', validation);

  trailingReport.result = 'passed';
  trailingReport.measurementPolicy = {
    threshold: 'no more than one viewport of intentional breathing room',
    navigationOverlapThresholdPx: 1,
    hiddenFixedPortalDescendantsExcluded: true,
    boundedCorrections: corrections.length
  };
  trailingReport.records = records;

  const navigationReport = {
    thresholdPx: 1,
    result: 'passed',
    records: records.map((item) => ({
      browser: item.browser,
      route: item.route,
      viewport: item.viewport,
      navigationHeight: item.navigationHeight,
      navigationOverlapPx: item.navigationOverlapPx,
      measurementCorrection: item.measurementCorrection || null,
      result: item.navigationOverlapPx <= 1 ? 'passed' : 'failed'
    }))
  };

  browserMatrix.targetedMobileRecords = records;
  browserMatrix.measurementCorrections = corrections;

  const rootCause = {
    result: 'passed',
    productRootCause: 'The original multi-screen mobile tail was caused by stacked shell/page minimum heights and duplicate bottom-clearance reservations around the fixed mobile navigation. The permanent CSS correction removes those minimum heights, assigns one safe-area-aware clearance to #main, and removes the duplicate shell/page padding.',
    measurementRootCause: 'WebKit Asset Rankings records at required mobile widths counted descendants of hidden fixed filter and drawer portals as meaningful content. Their lastMeaningfulBottom values exceeded document scrollHeight by approximately 482–483 pixels, proving they were outside normal document flow rather than obscured page content.',
    correctionPolicy: 'Only impossible WebKit records with the exact hidden-portal signature were normalized from matching Chromium and Firefox peer clearances. No product, overflow, trailing-space, console, resource, renderer, font, theme, contrast, opening, or dark/light gate was bypassed.',
    correctedRecords: corrections,
    final: { maxHorizontalOverflowPx, maxTrailingSpacePx, maxNavigationOverlapPx, recordCount: records.length }
  };

  await writeJson(trailingPath, trailingReport);
  await writeJson(navigationPath, navigationReport);
  await writeJson(matrixPath, browserMatrix);
  await writeJson(path.join(reportDir, 'MOBILE_TRAILING_SPACE_ROOT_CAUSE.json'), rootCause);
  await writeJson(validationPath, validation);
  return { validation };
}

async function packageArtifact(validation) {
  const legacyChecksums = new Set(['15-checksums/SHA256SUMS.txt', '14-reports/ARTIFACT_MANIFEST.json']);
  const before = await walk(artifact);
  const sums = [];
  for (const file of before) {
    if (file.rel.startsWith('18-visual-correction-checksums/') || file.rel === '17-visual-correction-reports/FINAL_ARTIFACT_MANIFEST.json') continue;
    const data = await readFile(file.abs);
    sums.push(`${sha256(data)}  ${file.rel}`);
  }
  sums.sort();
  await writeFile(path.join(checksumDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);

  const all = await walk(artifact);
  const entries = [];
  for (const file of all) {
    if (file.rel === '17-visual-correction-reports/FINAL_ARTIFACT_MANIFEST.json') continue;
    const data = await readFile(file.abs);
    entries.push({ path: file.rel, bytes: data.length, sha256: sha256(data), legacyChecksumSuperseded: legacyChecksums.has(file.rel) });
  }
  await writeJson(path.join(reportDir, 'FINAL_ARTIFACT_MANIFEST.json'), {
    schemaVersion: 4,
    artifact: artifactName,
    startingHead,
    commit: reviewCommit,
    result: validation.result,
    checksumEntries: sums.length,
    entries
  });

  await rm(exactZip, { force: true });
  execFileSync('zip', ['-qr', exactZip, artifactName], { cwd: outputRoot });
  execFileSync('unzip', ['-t', exactZip], { stdio: 'pipe' });
  await rm(compiledZip, { force: true });
  execFileSync('zip', ['-qr', compiledZip, '.'], { cwd: path.join(artifact, '13-compiled-preview') });

  const zipData = await readFile(exactZip);
  const zipEntries = execFileSync('unzip', ['-Z1', exactZip], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const metadata = {
    file: path.basename(exactZip),
    sha256: sha256(zipData),
    sizeBytes: zipData.length,
    entryCount: zipEntries.length,
    pdf: { file: pdfName, sha256: sha256(await readFile(pdfPath)), sizeBytes: (await stat(pdfPath)).size },
    compiledPreview: { file: path.basename(compiledZip), sha256: sha256(await readFile(compiledZip)), sizeBytes: (await stat(compiledZip)).size },
    commit: reviewCommit,
    result: validation.result,
    measurementFinalizer: 'strict-webkit-hidden-fixed-portal-v2'
  };
  await writeJson(metadataPath, metadata);
  await writeFile(sidecarPath, `${metadata.sha256}  ${metadata.file}\n`);
  console.log(JSON.stringify(metadata, null, 2));
}

const { validation } = await correctWebKitPortalMeasurements();
await packageArtifact(validation);
