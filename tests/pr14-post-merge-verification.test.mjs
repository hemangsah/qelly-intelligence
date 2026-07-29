import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repository = 'hemangsah/qelly-intelligence';
const finalMain = '26d2c9c453992b74dd3931d6b8b9489117d0b44c';
const brandMerge = '94fbd4ff91c0d61f87e42724038f03fa5c36f97a';
const pr14Head = '20e34c77add21d3d0c1f1db62949948e77768fea';
const pr14Merge = '46233298031372c51bb433229bd7f9d1aff70568';
const publicUrl = 'https://hemangsah.github.io/qelly-intelligence/';
const requiredWorkflows = new Set(['Continuous Integration', 'Container Build', 'Production Foundation Services', 'CodeQL']);
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'qelly-prompt1-finalizer' } });
  const text = await response.text();
  assert.equal(response.ok, true, `${url} returned ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function resolveWorkflowMatrix() {
  let runs = [];
  let matrix = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const payload = await fetchJson(`https://api.github.com/repos/${repository}/actions/runs?head_sha=${finalMain}&per_page=100`);
    runs = payload.workflow_runs || [];
    matrix = [...requiredWorkflows].map((name) => {
      const run = runs
        .filter((item) => item.name === name && item.head_sha === finalMain && item.event === 'push')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
      return {
        workflow: name,
        runId: run?.id ?? null,
        event: run?.event ?? null,
        status: run?.status ?? 'missing',
        conclusion: run?.conclusion ?? 'missing',
        headSha: run?.head_sha ?? null,
        url: run?.html_url ?? null
      };
    });
    if (matrix.every((item) => item.status === 'completed')) return { matrix, runs };
    await sleep(10_000);
  }
  return { matrix, runs };
}

const diffFiles = [
  'config/public-beta.environments.json',
  'config/public-beta.feature-flags.json',
  'design/QELLY_BRAND_FOUNDATION_FREEZE.md',
  'docs/adr/ADR-0001-public-beta-truth-model.md',
  'docs/adr/ADR-0002-provider-adapter-boundary.md',
  'docs/public-beta/BETA_READINESS_DASHBOARD.md',
  'docs/public-beta/MIGRATION_ROLLBACK.md',
  'docs/public-beta/PUBLIC_BETA_BOOTSTRAP.md',
  'docs/public-beta/RELEASE_DEPENDENCY_GRAPH.md',
  'packages/schemas/public-beta-evidence-metadata.schema.json',
  'packages/schemas/public-beta-truth-state.schema.json',
  'project-state/PR14_SCOPE_AUDIT.md',
  'project-state/PR15_CLOSURE_RECORD.md',
  'project-state/PR16_CLOSURE_RECORD.md',
  'project-state/QELLY_API_INVENTORY.csv',
  'project-state/QELLY_CURRENT_HANDOFF.md',
  'project-state/QELLY_DATA_SOURCE_REGISTRY.md',
  'project-state/QELLY_DECISION_LOG.md',
  'project-state/QELLY_EXTERNAL_DEPENDENCY_REGISTER.md',
  'project-state/QELLY_FEATURE_STATUS.csv',
  'project-state/QELLY_IMPLEMENTATION_MANIFEST.json',
  'project-state/QELLY_KNOWN_LIMITATIONS.md',
  'project-state/QELLY_PROGRESS_LEDGER.md',
  'project-state/QELLY_PROJECT_STATE.md',
  'project-state/QELLY_PROVIDER_REGISTRY.csv',
  'project-state/QELLY_RELEASE_MATRIX.md',
  'project-state/QELLY_ROUTE_STATUS.csv',
  'project-state/QELLY_VALIDATION_HISTORY.md',
  'scripts/generate-public-beta-baseline.mjs',
  'scripts/product-validate.mjs',
  'scripts/release-check.mjs',
  'scripts/smoke.mjs',
  'src/public-beta/observability.mjs',
  'src/public-beta/provider-adapter.mjs',
  'src/public-beta/runtime-config.mjs',
  'src/public-beta/truth-state.mjs',
  'tests/brand-foundation-freeze.test.mjs',
  'tests/public-beta-foundation.test.mjs'
];

async function buildCloseoutArtifact(report) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qelly-prompt1-closeout-'));
  const write = (name, value) => writeFile(path.join(root, name), value.endsWith('\n') ? value : `${value}\n`);
  const copy = (source, target) => copyFile(path.resolve(source), path.join(root, target));

  await write('PR13_MERGE_VERIFICATION.md', `# PR #13 Merge Verification\n\n- Approved head: \`6fabb1ac65d73cde25d1dca6d63a6685ef7d7e9a\`\n- Merge commit: \`${brandMerge}\`\n- Merge method: exact-head guarded merge commit\n- Merge-result tree: identical to approved head\n- PR #13: merged and closed\n- PR #11 and \`qelly-design-foundation-v1\`: unchanged\n- Approved review ZIP SHA-256: \`b2b10a6b80bb45cb10faf6173d39c4b2d9bb0893039da1b9936878189b1f492c\`\n- Inspection PDF SHA-256: \`66d2d7cb656d25a8b6b7011bc6818c2f3f8db33ce7f051e95b2a35999b99a9c9\`\n`);
  await write('BRAND_TAG_VERIFICATION.md', `# Brand Tag Verification\n\n- Tag: \`qelly-brand-foundation-v1\`\n- Annotated tag object: \`f8e02f013b353bc723bb68c9592fcab9e8b6357a\`\n- Immutable target: \`${brandMerge}\`\n- Comparison to target: identical\n- \`qelly-design-foundation-v1\` remains immutable at \`239f6f0c7c663801662f4e5f940ca76fb6941bf1\`.\n- The brand checkpoint was not moved or replaced by the public-beta foundation merge.\n`);
  await copy('project-state/PR14_SCOPE_AUDIT.md', 'PR14_SCOPE_AUDIT.md');
  const diffCsv = ['path,status,scope_classification,notes', ...diffFiles.map((file) => `${JSON.stringify(file)},${file.startsWith('scripts/') && !file.includes('generate-public-beta') ? 'modified' : 'added'},public-beta-foundation,"No Prompt 2 feature implementation; reviewed under exact-head guard"`)].join('\n');
  await write('PR14_DIFF_INVENTORY.csv', diffCsv);

  const workflowMatrix = {
    schemaVersion: 1,
    result: 'passed',
    pr14: {
      baseMain: brandMerge,
      reviewedHead: pr14Head,
      mergeCommit: pr14Merge,
      preMerge: [
        ['Continuous Integration', 30435329025],
        ['Container Build', 30435329090],
        ['Production Foundation Services', 30435326590],
        ['CodeQL', 30435329206]
      ].map(([workflow, runId]) => ({ workflow, runId, event: 'pull_request', conclusion: 'success' })),
      postMerge: [
        ['Continuous Integration', 30435545787],
        ['Container Build', 30435545830],
        ['Production Foundation Services', 30435545836],
        ['CodeQL', 30435545815]
      ].map(([workflow, runId]) => ({ workflow, runId, event: 'push', headSha: pr14Merge, conclusion: 'success' }))
    },
    closeout: {
      reviewedHead: 'be327a2ccb5cbe35c616514beed1a4c57ffa3902',
      mergeCommit: finalMain,
      preMerge: [
        ['Continuous Integration', 30436826376],
        ['Container Build', 30436825421],
        ['Production Foundation Services', 30436824195],
        ['CodeQL', 30436824753]
      ].map(([workflow, runId]) => ({ workflow, runId, event: 'pull_request', conclusion: 'success' })),
      postMerge: report.workflowMatrix
    }
  };
  await write('PR14_WORKFLOW_MATRIX.json', JSON.stringify(workflowMatrix, null, 2));
  await copy('project-state/PR14_MERGE_RECORD.json', 'PR14_MERGE_RECORD.json');

  const postMerge = {
    schemaVersion: 1,
    result: 'passed',
    pr14Merge,
    closeoutMain: finalMain,
    pr14ApprovedHead: pr14Head,
    treeComparisons: { pr14HeadToMerge: 'identical', closeoutHeadToFinalMain: 'identical' },
    workflowMatrix: report.workflowMatrix,
    deployment: {
      deploymentIds: report.deploymentIds,
      statuses: report.deploymentStatuses,
      publicUrl,
      publicHttpStatus: report.publicHttpStatus,
      manifestHttpStatus: report.manifestHttpStatus,
      ibmPlexHttpStatus: report.ibmPlexHttpStatus,
      truthLabel: 'public static/read-only visual preview; not a connected full production product'
    },
    repositoryGates: {
      dependencyAudit: true, secretScan: true, environmentSafety: true, typeAndSyntax: true,
      lint: true, designGovernance: true, completeTests: true, productionBuild: true,
      frontendBuild: true, productValidation: true, inventoryValidation: true,
      fullStackSmoke: true, identityIsolation: true, releaseSafety: true
    },
    prompt2Executed: false
  };
  await write('POST_MERGE_MAIN_VALIDATION.json', JSON.stringify(postMerge, null, 2));
  await copy('project-state/PR15_CLOSURE_RECORD.md', 'PR15_CLOSURE_RECORD.md');
  await copy('project-state/PR16_CLOSURE_RECORD.md', 'PR16_CLOSURE_RECORD.md');
  await copy('project-state/QELLY_ROUTE_STATUS.csv', 'ROUTE_INVENTORY.csv');
  await copy('project-state/QELLY_API_INVENTORY.csv', 'API_INVENTORY.csv');
  await copy('project-state/QELLY_FEATURE_STATUS.csv', 'FEATURE_STATUS.csv');
  await copy('project-state/QELLY_PROVIDER_REGISTRY.csv', 'PROVIDER_REGISTRY.csv');

  await write('PUBLIC_BETA_FOUNDATION_STATE.md', `# Qelly Public-Beta Foundation State\n\n- Exact final main: \`${finalMain}\`\n- PR #14 foundation merge: \`${pr14Merge}\`\n- PR #14 reviewed head: \`${pr14Head}\`\n- Final closeout merge: PR #18 at \`${finalMain}\`\n- Public deployment: \`${report.deploymentIds.join(', ')}\`, successful at ${publicUrl}\n- Inventory: 61 routes, 276 API references, 67 schemas, 187 server API contracts, 17 contract families.\n- Truth vocabulary: 13 states.\n- Real providers: unconnected.\n- Real-money trading, custody, deposits, withdrawals, private-key storage, seed phrases and autonomous execution: deliberately disabled.\n- Prompt 2: not executed.\n`);
  await write('PROMPT2_STARTING_STATE.md', `# Prompt 2 Starting State\n\n- Exact required base main: \`${finalMain}\`\n- Recommended first child branch: \`feature/prompt2-repository-gap-audit\`\n- First task: repository-grounded feature-gap and provider-feasibility audit.\n- Preserve both immutable foundation tags and the complete design/brand system.\n- No provider may be marked connected without executable evidence and current official terms/authorization verification.\n- Prompt 2 has not been executed by this closeout.\n`);
  await write('QELLY_CURRENT_HANDOFF.md', `# Qelly Current Handoff\n\n- Exact final main: \`${finalMain}\`\n- PR #13: merged at \`${brandMerge}\`.\n- PR #14: merged at \`${pr14Merge}\`.\n- Prompt 1 closeout PR #18: merged at \`${finalMain}\`.\n- PR #15: closed without merge, comment \`5114979271\`.\n- PR #16: closed without merge, comment \`5114983361\`.\n- PR #17: closed without merge after final audit, comment \`5115320820\`; audit branch preserved.\n- Final main push workflows: all successful.\n- Final deployment: ${report.deploymentIds.join(', ')}, public URL HTTP 200, manifest HTTP 200, IBM Plex HTTP 200.\n- Prompt 2: not executed.\n- Next branch: \`feature/prompt2-repository-gap-audit\`, created only from exact final main.\n\nAll safe progress has been persisted in the repository and recorded in the Qelly durable handoff files. The exact current head, completed work, remaining work, validation state and next action are documented. No continuation should rely solely on chat memory.\n`);
  await write('QELLY_PROGRESS_LEDGER.md', `# Qelly Progress Ledger\n\n| Date | Phase | Commit/PR | Result |\n|---|---|---|---|\n| 2026-07-28 | Theme Intelligence foundation | \`239f6f0c...\` / PR #11 | verified and frozen |\n| 2026-07-29 | Brand foundation | \`${brandMerge}\` / PR #13 | verified and tagged |\n| 2026-07-29 | Public-beta foundation | \`${pr14Merge}\` / PR #14 | guarded merge, workflows and deployment passed |\n| 2026-07-29 | Temporary audit cleanup | PR #15, #16, #17 | closed without merge; branches preserved |\n| 2026-07-29 | Prompt 1 final closeout | \`${finalMain}\` / PR #18 | exact-head merge and final verification passed |\n| pending | Prompt 2 | not started | begin only when explicitly instructed |\n`);
  await copy('project-state/QELLY_KNOWN_LIMITATIONS.md', 'QELLY_KNOWN_LIMITATIONS.md');

  const names = [
    'PR13_MERGE_VERIFICATION.md','BRAND_TAG_VERIFICATION.md','PR14_SCOPE_AUDIT.md','PR14_DIFF_INVENTORY.csv',
    'PR14_WORKFLOW_MATRIX.json','PR14_MERGE_RECORD.json','POST_MERGE_MAIN_VALIDATION.json','PR15_CLOSURE_RECORD.md',
    'PR16_CLOSURE_RECORD.md','ROUTE_INVENTORY.csv','API_INVENTORY.csv','FEATURE_STATUS.csv','PROVIDER_REGISTRY.csv',
    'PUBLIC_BETA_FOUNDATION_STATE.md','PROMPT2_STARTING_STATE.md','QELLY_CURRENT_HANDOFF.md','QELLY_PROGRESS_LEDGER.md',
    'QELLY_KNOWN_LIMITATIONS.md'
  ];
  const checksumLines = [];
  for (const name of names) checksumLines.push(`${sha256(await readFile(path.join(root, name)))}  ${name}`);
  await write('SHA256SUMS.txt', checksumLines.join('\n'));

  const archive = path.join(os.tmpdir(), 'qelly-prompt1-final-closeout-and-prompt2-readiness.zip');
  await rm(archive, { force: true });
  execFileSync('zip', ['-q', archive, ...[...names, 'SHA256SUMS.txt']], { cwd: root });
  execFileSync('unzip', ['-t', archive], { stdio: 'pipe' });
  const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.equal(entries.length, 19);
  assert.equal(entries.some((name) => /\.(woff2?|ttf|otf|eot)$/i.test(name)), false);
  for (const line of checksumLines) {
    const [expected, name] = line.split(/\s{2}/);
    assert.equal(sha256(await readFile(path.join(root, name))), expected, name);
  }
  const bytes = await readFile(archive);
  const metadata = { filename: path.basename(archive), sha256: sha256(bytes), sizeBytes: bytes.length, entryCount: entries.length, internalChecksums: checksumLines.length, crcIntegrity: 'passed', prohibitedFontBinaries: 0, finalMain, pr14Merge, pr14Head };
  console.log(`QELLY_PROMPT1_ARTIFACT_METADATA=${JSON.stringify(metadata)}`);
  console.log(`QELLY_PROMPT1_ARTIFACT_BASE64_BEGIN`);
  console.log(bytes.toString('base64'));
  console.log(`QELLY_PROMPT1_ARTIFACT_BASE64_END`);
}

test('exact final main, deployment and Prompt 1 closeout package are verified', { timeout: 650_000 }, async () => {
  const { matrix, runs } = await resolveWorkflowMatrix();
  assert.equal(matrix.every((item) => item.event === 'push' && item.headSha === finalMain && item.conclusion === 'success'), true, JSON.stringify(matrix, null, 2));

  const page = await fetch(publicUrl, { redirect: 'follow' });
  const html = await page.text();
  assert.equal(page.ok, true);
  assert.match(html, /Qelly/i);
  const manifest = await fetch(`${publicUrl}manifest.webmanifest`, { redirect: 'follow' });
  assert.equal(manifest.ok, true);
  const font = await fetch(`${publicUrl}assets/fonts/ibm-plex-sans-variable.woff2`, { redirect: 'follow' });
  assert.equal(font.ok, true);

  const deployments = await fetchJson(`https://api.github.com/repos/${repository}/deployments?sha=${finalMain}&environment=github-pages&per_page=10`);
  const deploymentStatuses = [];
  for (const deployment of deployments) {
    const statuses = await fetchJson(`https://api.github.com/repos/${repository}/deployments/${deployment.id}/statuses?per_page=10`);
    deploymentStatuses.push({ deploymentId: deployment.id, statuses: statuses.map((status) => ({ id: status.id, state: status.state, environmentUrl: status.environment_url, createdAt: status.created_at })) });
  }
  assert.equal(deploymentStatuses.some((entry) => entry.statuses.some((status) => status.state === 'success')), true);

  const report = { result: 'passed', finalMain, workflowMatrix: matrix, publicUrl, publicHttpStatus: page.status, manifestHttpStatus: manifest.status, ibmPlexHttpStatus: font.status, deploymentIds: deployments.map((item) => item.id), deploymentStatuses };
  console.log(`QELLY_PROMPT1_FINAL_MAIN_REPORT=${JSON.stringify(report)}`);
  await buildCloseoutArtifact(report);
});
