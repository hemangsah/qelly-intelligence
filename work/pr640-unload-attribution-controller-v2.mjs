import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const source = '5e5bfb0e306546987fdcde9df6eb1cbbf95107c9';
const root = path.resolve(process.env.QELLY_UNLOAD_SOURCE_ROOT);
const runner = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), source);
assert.equal(hash(await readFile(path.join(root, 'scripts/qelly-first-paint-stability.mjs'))), '840430bc1d6b636cc8525925bd0d316297cd466b77148453cb950031aaf12bdb');
const diagnostic = await readFile(path.join(runner, 'work/pr640-first-paint-unload-attribution-v2.mjs'));
assert.equal(hash(diagnostic), '249388058eed19f56010b656a22bd14dbbeb30725d1999b8ad13d0f2132de698');
await copyFile(path.join(runner, 'work/pr640-first-paint-unload-attribution-v2.mjs'), path.join(root, 'scripts/pr640-first-paint-unload-attribution-v2.mjs'));
const out = path.join(root, 'preview/first-paint-unload-attribution-v2');
await mkdir(out, { recursive: true });
const modes = [];
for (const mode of ['baseline', 'restrictive']) {
  const child = spawnSync(process.execPath, ['scripts/pr640-first-paint-unload-attribution-v2.mjs'], { cwd: root,
    env: { ...process.env, QELLY_UNLOAD_DIAGNOSTIC_MODE: mode }, encoding: 'utf8', maxBuffer: 10000000 });
  await mkdir(path.join(out, mode), { recursive: true });
  await writeFile(path.join(out, mode, 'original-strict-console.log'), (child.stdout ?? '') + (child.stderr ?? ''));
  if (child.error) throw child.error;
  assert.ok([0, 1].includes(child.status));
  const reportBytes = await readFile(path.join(out, mode, 'first-paint-stability.json'));
  const report = JSON.parse(reportBytes);
  assert.equal(report.releaseSha, source);
  assert.equal(report.scenarios.length, 4);
  assert.equal(child.status === 0, report.status === 'passed');
  for (const viewport of ['desktop', 'mobile']) for (const cacheMode of ['cold', 'warm']) {
    const matches = report.scenarios.filter(row => row.route === 'market' && row.viewport === viewport && row.mode === cacheMode);
    assert.equal(matches.length, 1);
    const attribution = matches[0].consoleAttribution;
    assert.equal(matches[0].frames.length, 8);
    assert.equal(attribution.browserVersion, '158.0.8127.18', 'Match the actual original failing binary, not the earlier unmatched156 diagnostic');
    assert.equal(attribution.allOriginalErrorsPreserved, true);
    assert.equal(attribution.productionPolicyChanged, false);
    assert.equal(attribution.browserFlagsChanged, false);
    assert.equal(attribution.restrictiveFixtureControl, mode === 'restrictive');
    assert.equal(attribution.originalStrictResult, matches[0].status);
  }
  modes.push({ mode, originalStrictExitCode: child.status, originalStrictReportStatus: report.status,
    reportSha256: hash(reportBytes), scenarios: report.scenarios.map(row => ({ viewport: row.viewport, mode: row.mode,
      status: row.status, errors: row.errors, structural: row.structural, obsolete: row.obsolete, consoleAttribution: row.consoleAttribution })),
    routeCycleStatus: report.routeCycleStability?.status, decisionChaosStatus: report.decisionChaosStability?.status });
}
const receipt = { schema: 'qelly.unload.source-attribution/2.0', source, diagnosticHead: process.env.QELLY_UNLOAD_DIAGNOSTIC_HEAD,
  originalFailingBrowser: '158.0.8127.18', pythonBrowserInstallerVersion: '1.65.0', nodePlaywrightLockedVersion: '1.63.0',
  firstDiagnosticBrowser: '156.0.8078.0', firstDiagnosticDidNotEstablishIntermittency: true,
  targetedContexts: 8, firstPaintAcceptanceGranted: false, errorsFiltered: false,
  productionPolicyOrBrowserFlagsChanged: false, restrictiveFixtureControlExplicit: true, modes,
  boundary: 'Matched-browser source attribution. Baseline headers/flags remain unchanged; a separate stricter unload=() fixture is a retained negative control. No production policy, classifier, PR source or error acceptance change. Original strict child statuses remain authoritative.',
  recordedAt: new Date().toISOString() };
await writeFile(path.join(out, 'collector-status.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ source, browser: '158.0.8127.18', collectionComplete: true, firstPaintAcceptanceGranted: false,
  modes: modes.map(mode => ({ mode: mode.mode, originalStrictExit: mode.originalStrictExitCode, originalStrictStatus: mode.originalStrictReportStatus })) }));
