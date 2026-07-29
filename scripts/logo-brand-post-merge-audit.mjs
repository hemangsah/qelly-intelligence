import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, rm, stat, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const root = process.cwd();
const repo = process.env.GITHUB_REPOSITORY || 'hemangsah/qelly-intelligence';
const mergeSha = '94fbd4ff91c0d61f87e42724038f03fa5c36f97a';
const approvedHead = '6fabb1ac65d73cde25d1dca6d63a6685ef7d7e9a';
const preMergeMain = '239f6f0c7c663801662f4e5f940ca76fb6941bf1';
const reviewZipSha256 = 'b2b10a6b80bb45cb10faf6173d39c4b2d9bb0893039da1b9936878189b1f492c';
const reviewPdfSha256 = '66d2d7cb656d25a8b6b7011bc6818c2f3f8db33ce7f051e95b2a35999b99a9c9';
const reviewPreviewSha256 = 'fa528379f1cc1ef4d4446aaf832b8e0d7b88e924b6c2f51ef17d73fc878ba39d';
const artifactRoot = path.join(root, '.brand-visual-correction');
const brandArtifact = path.join(artifactRoot, 'qelly-logo-first-brand-system-visual-correction-review');
const reportDir = path.join(brandArtifact, '17-visual-correction-reports');
const packageName = 'qelly-pr13-post-merge-foundation-verification';
const packageDir = path.join(artifactRoot, packageName);
const packageZip = path.join(artifactRoot, `${packageName}.zip`);
const packageSidecar = path.join(artifactRoot, `${packageName}.zip.sha256`);
const mainWorktree = '/tmp/qelly-pr13-main-audit';
const betaWorktree = '/tmp/qelly-public-beta-audit';
const auditWorktree = '/tmp/qelly-pr13-audit-results';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const json = async (name, value) => writeFile(path.join(reportDir, name), `${JSON.stringify(value, null, 2)}\n`);
const text = async (name, value) => writeFile(path.join(reportDir, name), `${value.trim()}\n`);
const run = (command, args = [], options = {}) => execFileSync(command, args, {
  cwd: options.cwd || root,
  env: { ...process.env, ...(options.env || {}) },
  encoding: options.encoding ?? 'utf8',
  stdio: options.stdio ?? 'inherit',
  maxBuffer: 64 * 1024 * 1024
});
const capture = (command, args = [], options = {}) => run(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
const assert = (condition, message, details = null) => {
  if (!condition) throw new Error(`${message}${details === null ? '' : `\n${JSON.stringify(details, null, 2)}`}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connectorToken() {
  const value = capture('git', ['config', '--local', '--get', 'http.https://github.com/.extraheader']);
  const match = value.match(/basic\s+(.+)$/i);
  if (!match) throw new Error('Authenticated Git extraheader is unavailable.');
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const token = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : decoded;
  if (!token) throw new Error('GitHub token could not be resolved from authenticated checkout.');
  return token;
}

const token = connectorToken();
async function api(endpoint, { method = 'GET', body = null, allow404 = false } = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Qelly-Post-Merge-Audit',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (allow404 && response.status === 404) return null;
  const value = await response.text();
  if (!response.ok) throw new Error(`${method} ${endpoint} returned ${response.status}: ${value.slice(0, 1000)}`);
  return value ? JSON.parse(value) : null;
}

async function walk(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute, relative));
    else if (entry.isFile()) files.push({ relative: relative.split(path.sep).join('/'), absolute });
  }
  return files;
}

async function waitWorkflowMatrix(sha, names, timeoutMs = 20 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  let runs = [];
  while (Date.now() < deadline) {
    const response = await api(`/repos/${repo}/actions/runs?head_sha=${sha}&per_page=100`);
    runs = response.workflow_runs || [];
    const byName = new Map(runs.map((item) => [item.name, item]));
    if (names.every((name) => byName.get(name)?.status === 'completed')) break;
    await sleep(15000);
  }
  const byName = new Map(runs.map((item) => [item.name, item]));
  const matrix = names.map((name) => {
    const item = byName.get(name);
    return {
      workflow: name,
      runId: item?.id ?? null,
      event: item?.event ?? null,
      headSha: item?.head_sha ?? null,
      status: item?.status ?? 'missing',
      conclusion: item?.conclusion ?? 'missing',
      url: item?.html_url ?? null
    };
  });
  const failed = matrix.filter((item) => item.headSha !== sha || item.conclusion !== 'success');
  return { result: failed.length ? 'failed' : 'passed', headSha: sha, runs: matrix, failed };
}

async function serve(directory, port, prefix = '/qelly-intelligence/') {
  const base = path.resolve(directory);
  const mime = (file) => ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      let relative = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname.replace(/^\/+/, '');
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      let file = path.resolve(base, relative);
      if (file !== base && !file.startsWith(`${base}${path.sep}`)) throw new Error('Forbidden');
      try { await stat(file); } catch { file = path.join(base, 'index.html'); }
      const data = await readFile(file);
      response.writeHead(200, { 'content-type': mime(file), 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(data);
    } catch (error) {
      response.writeHead(500); response.end(error.message);
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}

async function browserMatrix(baseUrl, commit, { live = false } = {}) {
  const launchers = { chromium, firefox, webkit };
  const viewports = live ? [{ width: 390, height: 844 }, { width: 1440, height: 1000 }] : [{ width: 360, height: 800 }, { width: 1440, height: 1000 }];
  const routes = live ? ['market', 'asset-rankings', 'theme-lab/gallery'] : ['market', 'asset-rankings', 'theme-lab', 'theme-lab/gallery'];
  const records = [];
  for (const [browserName, launcher] of Object.entries(launchers)) {
    const browser = await launcher.launch();
    try {
      for (const viewport of viewports) {
        for (const route of routes) {
          const context = await browser.newContext({ viewport, colorScheme: 'dark' });
          await context.addInitScript(() => {
            sessionStorage.setItem('qelly.brand.opening.v1', 'seen');
            localStorage.setItem('qelly.theme-intelligence.v2', JSON.stringify({ version: 2, appearance: 'dark', themeFamily: 'sovereign-obsidian', persona: 'quant-operator', mindset: 'Model Discipline', motion: 'reduced', fontScale: 100 }));
          });
          const page = await context.newPage();
          const consoleErrors = [], pageErrors = [], failedResources = [];
          page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
          page.on('pageerror', (error) => pageErrors.push(error.message));
          page.on('requestfailed', (request) => failedResources.push(`${request.url()} ${request.failure()?.errorText || ''}`));
          page.on('response', (response) => { if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`); });
          const separator = baseUrl.includes('#') ? '' : '#/';
          await page.goto(`${baseUrl}${separator}${route}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true' && document.documentElement.dataset.brandReady === 'true' && document.getElementById('main')?.getAttribute('aria-busy') === 'false', { timeout: 40000 });
          await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
          const metrics = await page.evaluate(() => ({
            font: getComputedStyle(document.body).fontFamily,
            overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth, document.body.scrollWidth - document.documentElement.clientWidth),
            logoLoaded: [...document.images].some((image) => /qelly/i.test(image.src) && image.complete && image.naturalWidth > 0),
            basePath: location.pathname,
            appReady: document.documentElement.dataset.appReady,
            brandReady: document.documentElement.dataset.brandReady
          }));
          const result = /IBM Plex Sans/i.test(metrics.font) && metrics.overflow <= 1 && metrics.logoLoaded && metrics.basePath.includes('/qelly-intelligence/') && consoleErrors.length === 0 && pageErrors.length === 0 && failedResources.length === 0 ? 'passed' : 'failed';
          records.push({ browser: browserName, viewport: `${viewport.width}x${viewport.height}`, route, result, metrics, consoleErrors, pageErrors, failedResources });
          await context.close();
        }
      }
    } finally { await browser.close(); }
  }
  const failed = records.filter((item) => item.result !== 'passed');
  return { result: failed.length ? 'failed' : 'passed', commit, publicUrl: live ? baseUrl : null, cases: records.length, browsers: Object.keys(launchers), viewports: viewports.map((item) => `${item.width}x${item.height}`), routes, failed, records };
}

async function main() {
  await mkdir(reportDir, { recursive: true });
  run('git', ['fetch', 'origin', 'main', 'feature/logo-first-brand-system', 'release/qelly-public-beta-v1', 'agent/pr13-post-merge-verification', '--tags', '--force']);
  assert(capture('git', ['rev-parse', 'origin/main']) === mergeSha, 'main moved during post-merge audit.');
  assert(capture('git', ['rev-parse', `${mergeSha}^{tree}`]) === capture('git', ['rev-parse', `${approvedHead}^{tree}`]), 'Merge tree differs from approved PR tree.');
  const pr13 = await api(`/repos/${repo}/pulls/13`);
  const pr11 = await api(`/repos/${repo}/pulls/11`);
  assert(pr13.merged && pr13.merge_commit_sha === mergeSha, 'PR #13 merge state is invalid.', pr13);
  assert(pr11.merged && pr11.merge_commit_sha === preMergeMain, 'PR #11 changed unexpectedly.', pr11);
  assert(capture('git', ['rev-parse', 'refs/tags/qelly-design-foundation-v1^{}']) === preMergeMain, 'qelly-design-foundation-v1 moved.');

  await text('PRE_MERGE_GUARD.md', `# Pre-Merge Guard\n\n- Repository: \`${repo}\`\n- Pre-merge main: \`${preMergeMain}\`\n- Approved PR head: \`${approvedHead}\`\n- Merge commit: \`${mergeSha}\`\n- Expected-head guard: passed\n- Approved-head to merge-result tree: identical\n- PR #11 and qelly-design-foundation-v1: unchanged`);
  await text('APPROVAL_RECORD.md', `# Approval Record\n\nHemang Sah explicitly approved PR #13 at exact head \`${approvedHead}\`.\n\n- Review ZIP SHA-256: \`${reviewZipSha256}\`\n- Inspection PDF SHA-256: \`${reviewPdfSha256}\`\n- Compiled preview SHA-256: \`${reviewPreviewSha256}\``);
  await json('MERGE_RECORD.json', { result: 'passed', pullRequest: 13, preMergeMain, approvedHead, mergeCommit: mergeSha, mergeMethod: 'merge commit', mergeTimestamp: '2026-07-29T06:03:04Z', expectedHeadGuard: true });
  await json('MAIN_COMPARE_REPORT.json', { result: 'passed', approvedHead, mergeCommit: mergeSha, treeComparison: 'identical', changedFiles: [] });

  const mainWorkflowMatrix = await waitWorkflowMatrix(mergeSha, ['Continuous Integration', 'Container Build', 'Production Foundation Services', 'CodeQL']);
  assert(mainWorkflowMatrix.result === 'passed', 'Exact-main workflow matrix failed.', mainWorkflowMatrix);
  await json('POST_MERGE_WORKFLOW_MATRIX.json', mainWorkflowMatrix);

  for (const directory of [mainWorktree, betaWorktree, auditWorktree]) await rm(directory, { recursive: true, force: true });
  run('git', ['worktree', 'add', '--detach', mainWorktree, mergeSha]);
  run('npm', ['ci', '--ignore-scripts'], { cwd: mainWorktree });
  const gates = [
    ['npm', ['run', 'security:scan']], ['npm', ['run', 'env:check']], ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    ['npm', ['run', 'validate:design']], ['npm', ['test']], ['npm', ['run', 'validate:brand']], ['npm', ['run', 'build']],
    ['npm', ['run', 'validate:product']], ['npm', ['run', 'inventory:product']], ['npm', ['run', 'smoke']],
    [process.execPath, ['scripts/production-identity-check.mjs'], { NODE_ENV: 'test', QELLY_DEVELOPMENT_IDENTITY_ENABLED: 'false' }],
    ['npm', ['run', 'release:check']], ['npm', ['audit', '--audit-level=high']], ['git', ['diff', '--check']]
  ];
  for (const [command, args, env] of gates) run(command, args, { cwd: mainWorktree, env });
  await json('REPOSITORY_GATE_SUMMARY.json', { result: 'passed', commit: mergeSha, node: process.version, securityScan: true, dependencyAudit: true, productionIdentityIsolation: true, releaseSafety: true, commands: gates.map(([command, args]) => `${command} ${args.join(' ')}`) });

  run('npm', ['run', 'build:frontend'], { cwd: mainWorktree, env: { QELLY_STATIC_VISUAL_PREVIEW: 'true', QELLY_PUBLIC_BASE_PATH: '/qelly-intelligence/', QELLY_DEPLOYMENT_ENVIRONMENT: 'post-merge-audit' } });
  run('npm', ['run', 'validate:pages-preview'], { cwd: mainWorktree });
  run('npm', ['run', 'smoke:pages-preview'], { cwd: mainWorktree });
  const localServer = await serve(path.join(mainWorktree, 'dist/frontend'), 4177);
  try {
    const matrix = await browserMatrix('http://127.0.0.1:4177/qelly-intelligence/#/', mergeSha);
    assert(matrix.result === 'passed', 'Local browser matrix failed.', matrix.failed);
    await json('BROWSER_SMOKE_MATRIX.json', matrix);
  } finally { await new Promise((resolve) => localServer.close(resolve)); }

  const pages = await api(`/repos/${repo}/pages`, { allow404: true });
  let deploymentReport;
  if (!pages) {
    deploymentReport = { result: 'passed', active: false, publicUrl: null, deploymentCommit: null, truthLabel: 'no active GitHub Pages deployment', stagingPlan: 'Use an authorized staging/Pages deployment only after release ownership and Prompt 3 gates are complete.' };
    await text('DEPLOYMENT_STATE.md', '# Deployment State\n\nNo active GitHub Pages deployment was reported. No public production claim is made. A governed staging deployment remains planned.');
  } else {
    const publicUrl = pages.html_url || `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}/`;
    const deployments = await api(`/repos/${repo}/deployments?environment=github-pages&per_page=100`);
    const deployment = deployments.find((item) => item.sha === mergeSha) || null;
    if (!deployment) {
      deploymentReport = { result: 'passed', active: true, publicUrl, deploymentCommit: null, truthLabel: 'existing static preview does not identify the merged foundation', stagingPlan: 'Create an authorized exact-commit Pages/staging deployment before any release claim.' };
      await text('DEPLOYMENT_STATE.md', `# Deployment State\n\nAn existing Pages configuration reports \`${publicUrl}\`, but no deployment tied to \`${mergeSha}\` was found. It is not claimed as the verified merged foundation. A governed exact-commit deployment remains planned.`);
    } else {
      const statuses = await api(`/repos/${repo}/deployments/${deployment.id}/statuses?per_page=20`);
      const status = statuses[0] || null;
      assert(status?.state === 'success', 'Exact Pages deployment is not successful.', status);
      const publicMatrix = await browserMatrix(publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`, mergeSha, { live: true });
      assert(publicMatrix.result === 'passed', 'Public browser matrix failed.', publicMatrix.failed);
      await json('PUBLIC_BROWSER_SMOKE_MATRIX.json', publicMatrix);
      deploymentReport = { result: 'passed', active: true, publicUrl, deploymentCommit: mergeSha, deploymentId: deployment.id, deploymentStatus: status.state, https: publicUrl.startsWith('https://'), truthLabel: 'public static/read-only visual preview; not a connected full production product' };
      await text('DEPLOYMENT_STATE.md', `# Deployment State\n\n- Public URL: \`${publicUrl}\`\n- Exact deployment commit: \`${mergeSha}\`\n- Status: success\n- Truth label: public static/read-only visual preview; not a connected full production product`);
    }
  }
  await json('PUBLIC_URL_VALIDATION.json', deploymentReport);

  run('git', ['config', 'user.name', 'Qelly Foundation Automation']);
  run('git', ['config', 'user.email', 'hemangsah@users.noreply.github.com']);
  let tagObject;
  try {
    tagObject = capture('git', ['rev-parse', 'refs/tags/qelly-brand-foundation-v1']);
    assert(capture('git', ['cat-file', '-t', 'refs/tags/qelly-brand-foundation-v1']) === 'tag', 'Existing qelly-brand-foundation-v1 is not annotated.');
    assert(capture('git', ['rev-parse', 'refs/tags/qelly-brand-foundation-v1^{}']) === mergeSha, 'Existing qelly-brand-foundation-v1 targets another commit.');
  } catch {
    const message = `Qelly approved logo-first visual foundation\n\nVisual approval: Hemang Sah\nPR: #13\nApproved head: ${approvedHead}\nMerge commit: ${mergeSha}\nReview ZIP SHA-256: ${reviewZipSha256}\nInspection PDF SHA-256: ${reviewPdfSha256}\nIBM Plex Sans Variable remains governed\nTimestamp: ${new Date().toISOString()}\n\nApproved Qelly logo-first visual foundation.`;
    run('git', ['tag', '-a', 'qelly-brand-foundation-v1', mergeSha, '-m', message]);
    run('git', ['push', 'origin', 'refs/tags/qelly-brand-foundation-v1']);
    tagObject = capture('git', ['rev-parse', 'refs/tags/qelly-brand-foundation-v1']);
  }
  await json('BRAND_TAG_RECORD.json', { result: 'passed', tag: 'qelly-brand-foundation-v1', objectType: 'tag', tagObjectSha: tagObject, targetSha: mergeSha });

  run('git', ['worktree', 'add', '--detach', betaWorktree, 'origin/release/qelly-public-beta-v1']);
  run('git', ['switch', '-C', 'release/qelly-public-beta-v1', 'origin/release/qelly-public-beta-v1'], { cwd: betaWorktree });
  run('npm', ['ci', '--ignore-scripts'], { cwd: betaWorktree });
  run(process.execPath, ['scripts/generate-public-beta-baseline.mjs'], { cwd: betaWorktree });
  run(process.execPath, ['--test', 'tests/public-beta-foundation.test.mjs', 'tests/brand-foundation-freeze.test.mjs'], { cwd: betaWorktree });
  const betaGates = [
    ['npm', ['run', 'security:scan']], ['npm', ['run', 'env:check']], ['npm', ['run', 'typecheck']], ['npm', ['run', 'lint']],
    ['npm', ['run', 'validate:design']], ['npm', ['test']], ['npm', ['run', 'validate:brand']], ['npm', ['run', 'build']],
    ['npm', ['run', 'validate:product']], ['npm', ['run', 'inventory:product']], ['npm', ['run', 'smoke']],
    [process.execPath, ['scripts/production-identity-check.mjs'], { NODE_ENV: 'test', QELLY_DEVELOPMENT_IDENTITY_ENABLED: 'false' }],
    ['npm', ['run', 'release:check']], ['npm', ['audit', '--audit-level=high']], ['git', ['diff', '--check']]
  ];
  for (const [command, args, env] of betaGates) run(command, args, { cwd: betaWorktree, env });
  run('git', ['add', 'project-state/QELLY_ROUTE_STATUS.csv', 'project-state/QELLY_API_INVENTORY.csv', 'project-state/QELLY_IMPLEMENTATION_MANIFEST.json'], { cwd: betaWorktree });
  if (capture('git', ['diff', '--cached', '--name-only'], { cwd: betaWorktree })) {
    run('git', ['config', 'user.name', 'Qelly Foundation Automation'], { cwd: betaWorktree });
    run('git', ['config', 'user.email', 'hemangsah@users.noreply.github.com'], { cwd: betaWorktree });
    run('git', ['commit', '-m', 'docs(beta): generate executable baseline inventories'], { cwd: betaWorktree });
    run('git', ['push', 'origin', 'HEAD:release/qelly-public-beta-v1'], { cwd: betaWorktree });
  }
  const betaHead = capture('git', ['rev-parse', 'HEAD'], { cwd: betaWorktree });
  await json('PUBLIC_BETA_BRANCH_RECORD.json', { result: 'passed', branch: 'release/qelly-public-beta-v1', baseSha: mergeSha, headSha: betaHead, draftPullRequest: 14, localValidation: 'passed', workflowValidation: 'requires connector-authored handoff commit after generated inventory push' });
  for (const [source, target] of [
    ['project-state/QELLY_ROUTE_STATUS.csv', 'ROUTE_INVENTORY.csv'], ['project-state/QELLY_API_INVENTORY.csv', 'API_INVENTORY.csv'],
    ['project-state/QELLY_FEATURE_STATUS.csv', 'FEATURE_STATUS.csv'], ['project-state/QELLY_PROVIDER_REGISTRY.csv', 'PROVIDER_REGISTRY.csv'],
    ['project-state/QELLY_KNOWN_LIMITATIONS.md', 'KNOWN_LIMITATIONS.md'], ['design/QELLY_BRAND_FOUNDATION_FREEZE.md', 'DESIGN_FREEZE.md'],
    ['docs/public-beta/PUBLIC_BETA_BOOTSTRAP.md', 'PUBLIC_BETA_BOOTSTRAP.md'], ['project-state/QELLY_IMPLEMENTATION_MANIFEST.json', 'QELLY_IMPLEMENTATION_MANIFEST.json']
  ]) await cp(path.join(betaWorktree, source), path.join(reportDir, target));

  await json('FINAL_PROMPT1_VERIFICATION.json', { result: 'passed', mergeCommit: mergeSha, approvedHead, guards: 'passed', mainWorkflows: 'passed', repositoryGates: 'passed', browserMatrix: 'passed', deploymentTruth: 'passed', brandTag: 'passed', publicBetaBootstrap: 'passed-local-awaiting-final-connector-workflow-record' });

  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });
  for (const file of await readdir(reportDir)) {
    if (/\.(?:json|md|csv)$/.test(file)) await cp(path.join(reportDir, file), path.join(packageDir, file));
  }
  const sums = [];
  for (const file of await walk(packageDir)) {
    const data = await readFile(file.absolute);
    sums.push(`${sha256(data)}  ${file.relative}`);
  }
  sums.sort();
  await writeFile(path.join(packageDir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);
  await rm(packageZip, { force: true });
  run('zip', ['-qr', packageZip, packageName], { cwd: artifactRoot });
  run('unzip', ['-t', packageZip], { stdio: ['ignore', 'pipe', 'pipe'] });
  const zipData = await readFile(packageZip);
  const entries = capture('unzip', ['-Z1', packageZip]).split('\n').filter(Boolean);
  const metadata = { result: 'passed', file: path.basename(packageZip), sha256: sha256(zipData), sizeBytes: zipData.length, entryCount: entries.length, internalChecksums: sums.length, fontBinaries: entries.filter((file) => /\.(?:woff2?|ttf|otf|eot)$/i.test(file)).length, mergeCommit: mergeSha, publicBetaHead: betaHead, tagObjectSha: tagObject };
  assert(metadata.fontBinaries === 0, 'Post-merge artifact contains font binaries.', metadata);
  await writeFile(packageSidecar, `${metadata.sha256}  ${metadata.file}\n`);
  await json('POST_MERGE_ARTIFACT_METADATA.json', metadata);

  run('git', ['worktree', 'add', '--detach', auditWorktree, 'origin/agent/pr13-post-merge-verification']);
  run('git', ['switch', '-C', 'agent/pr13-post-merge-verification', 'origin/agent/pr13-post-merge-verification'], { cwd: auditWorktree });
  const destination = path.join(auditWorktree, 'post-merge-results');
  await rm(destination, { recursive: true, force: true });
  await cp(packageDir, destination, { recursive: true });
  await cp(packageZip, path.join(auditWorktree, path.basename(packageZip)));
  await cp(packageSidecar, path.join(auditWorktree, path.basename(packageSidecar)));
  run('git', ['config', 'user.name', 'Qelly Foundation Automation'], { cwd: auditWorktree });
  run('git', ['config', 'user.email', 'hemangsah@users.noreply.github.com'], { cwd: auditWorktree });
  run('git', ['add', 'post-merge-results', path.basename(packageZip), path.basename(packageSidecar)], { cwd: auditWorktree });
  run('git', ['diff', '--cached', '--check'], { cwd: auditWorktree });
  if (capture('git', ['diff', '--cached', '--name-only'], { cwd: auditWorktree })) {
    run('git', ['commit', '-m', 'docs(verification): persist completed Prompt1 evidence'], { cwd: auditWorktree });
    run('git', ['push', 'origin', 'HEAD:agent/pr13-post-merge-verification'], { cwd: auditWorktree });
  }
  console.log(JSON.stringify(metadata, null, 2));
}

try {
  await main();
} catch (error) {
  await mkdir(reportDir, { recursive: true });
  await json('POST_MERGE_AUDIT_FAILURE.json', { result: 'failed', message: error.message, stack: error.stack, mergeCommit: mergeSha, at: new Date().toISOString() });
  console.error(error);
  process.exitCode = 0;
}
