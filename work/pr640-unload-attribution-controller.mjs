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
const diagnostic = await readFile(path.join(runner, 'work/pr640-first-paint-unload-attribution.mjs'));
assert.equal(hash(diagnostic), 'e704dae1cec5cc7ee63cd90d24268fd5a0be465165b51d1cf5c019cd188a1e97');
await copyFile(path.join(runner, 'work/pr640-first-paint-unload-attribution.mjs'), path.join(root, 'scripts/pr640-first-paint-unload-attribution.mjs'));
const child = spawnSync(process.execPath, ['scripts/pr640-first-paint-unload-attribution.mjs'], { cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 10000000 });
const out = path.join(root, 'preview/first-paint-unload-attribution');
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'original-strict-console.log'), (child.stdout ?? '') + (child.stderr ?? ''));
if (child.error) throw child.error;
assert.ok([0, 1].includes(child.status));
const reportBytes = await readFile(path.join(out, 'first-paint-stability.json'));
const report = JSON.parse(reportBytes);
assert.equal(report.releaseSha, source);
assert.equal(report.scenarios.length, 4);
assert.equal(child.status === 0, report.status === 'passed');
for (const viewport of ['desktop', 'mobile']) for (const mode of ['cold', 'warm']) {
  const matches = report.scenarios.filter(row => row.route === 'market' && row.viewport === viewport && row.mode === mode);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].frames.length, 8);
  assert.equal(matches[0].consoleAttribution.allOriginalErrorsPreserved, true);
  assert.equal(matches[0].consoleAttribution.policyOrBrowserFlagsChanged, false);
  assert.equal(matches[0].consoleAttribution.originalStrictResult, matches[0].status);
}
const selected = report.scenarios.map(row => ({ viewport: row.viewport, mode: row.mode, status: row.status,
  errors: row.errors, structural: row.structural, obsolete: row.obsolete, consoleAttribution: row.consoleAttribution }));
const receipt = { schema: 'qelly.unload.source-attribution/1.0', source, diagnosticHead: process.env.QELLY_UNLOAD_DIAGNOSTIC_HEAD,
  originalStrictExitCode: child.status, originalStrictReportStatus: report.status,
  originalStrictGatePassed: report.status === 'passed', firstPaintAcceptanceGranted: false,
  reportSha256: hash(reportBytes), targetedScenarios: 4, originalConsoleErrorsAndAssertionsPreserved: true,
  permissionsOrBrowserFlagsChanged: false, firstPartyOrUnattributedErrorsFiltered: false,
  scenarios: selected, routeCycleStatus: report.routeCycleStability?.status,
  decisionChaosStatus: report.decisionChaosStability?.status,
  boundary: 'Diagnostic collection success is not original first-paint acceptance. All original errors and strict child exit are preserved; no error classifier, permission opt-in, product change or blanket exception.',
  recordedAt: new Date().toISOString() };
await writeFile(path.join(out, 'collector-status.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ source, originalStrictExitCode: child.status, originalStrictReportStatus: report.status,
  collectionComplete: true, firstPaintAcceptanceGranted: false, errorsFiltered: false,
  browserVersion: selected[0].consoleAttribution.browserVersion, targetedScenarios: 4 }));
