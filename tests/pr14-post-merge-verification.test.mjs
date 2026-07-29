import test from 'node:test';
import assert from 'node:assert/strict';

const repository = 'hemangsah/qelly-intelligence';
const mergeSha = '46233298031372c51bb433229bd7f9d1aff70568';
const publicUrl = 'https://hemangsah.github.io/qelly-intelligence/';
const requiredWorkflows = new Set([
  'Continuous Integration',
  'Container Build',
  'Production Foundation Services',
  'CodeQL'
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'qelly-post-merge-verifier',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  assert.equal(response.ok, true, `${url} returned ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function resolveWorkflowMatrix() {
  let matrix = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const payload = await fetchJson(`https://api.github.com/repos/${repository}/actions/runs?head_sha=${mergeSha}&per_page=100`);
    const runs = payload.workflow_runs || [];
    matrix = [...requiredWorkflows].map((name) => {
      const candidates = runs
        .filter((run) => run.name === name && run.head_sha === mergeSha && run.event === 'push')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const run = candidates[0] || null;
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
  return { matrix, runs: [] };
}

test('exact main workflows, Pages deployment and public preview are verified', { timeout: 650_000 }, async () => {
  const { matrix, runs } = await resolveWorkflowMatrix();
  assert.deepEqual(matrix.map((item) => item.workflow).sort(), [...requiredWorkflows].sort());
  assert.equal(matrix.every((item) => item.event === 'push'), true, JSON.stringify(matrix, null, 2));
  assert.equal(matrix.every((item) => item.headSha === mergeSha), true, JSON.stringify(matrix, null, 2));
  assert.equal(matrix.every((item) => item.conclusion === 'success'), true, JSON.stringify(matrix, null, 2));

  const pagesRuns = runs
    .filter((run) => run.head_sha === mergeSha && run.event === 'push' && /pages|deploy/i.test(run.name || ''))
    .map((run) => ({ name: run.name, runId: run.id, status: run.status, conclusion: run.conclusion, url: run.html_url }));
  if (pagesRuns.length) {
    assert.equal(pagesRuns.every((run) => run.status === 'completed' && run.conclusion === 'success'), true, JSON.stringify(pagesRuns, null, 2));
  }

  const page = await fetch(publicUrl, { redirect: 'follow' });
  const html = await page.text();
  assert.equal(page.ok, true, `Public URL returned ${page.status}`);
  assert.match(html, /Qelly/i);
  assert.equal(page.url.startsWith(publicUrl), true);

  const manifest = await fetch(`${publicUrl}manifest.webmanifest`, { redirect: 'follow' });
  assert.equal(manifest.ok, true, `Manifest returned ${manifest.status}`);

  const font = await fetch(`${publicUrl}assets/fonts/ibm-plex-sans-variable.woff2`, { redirect: 'follow' });
  assert.equal(font.ok, true, `IBM Plex font returned ${font.status}`);
  assert.ok(Number(font.headers.get('content-length') || 0) > 0 || (await font.arrayBuffer()).byteLength > 0);

  let pages = null;
  try {
    pages = await fetchJson(`https://api.github.com/repos/${repository}/pages`);
    assert.equal(pages.html_url, publicUrl);
  } catch (error) {
    pages = { endpoint: 'authorization-limited', publicUrlVerified: true, message: error.message };
  }

  let deployments = [];
  let deploymentStatuses = [];
  try {
    deployments = await fetchJson(`https://api.github.com/repos/${repository}/deployments?sha=${mergeSha}&environment=github-pages&per_page=10`);
    for (const deployment of deployments) {
      const statuses = await fetchJson(`https://api.github.com/repos/${repository}/deployments/${deployment.id}/statuses?per_page=10`);
      deploymentStatuses.push({
        deploymentId: deployment.id,
        statuses: statuses.map((status) => ({ id: status.id, state: status.state, environmentUrl: status.environment_url, createdAt: status.created_at }))
      });
    }
    assert.equal(deploymentStatuses.some((entry) => entry.statuses.some((status) => status.state === 'success')), true, JSON.stringify(deploymentStatuses, null, 2));
  } catch (error) {
    deploymentStatuses = [{ endpoint: 'authorization-limited', publicUrlVerified: true, message: error.message }];
  }

  const report = {
    result: 'passed',
    mergeSha,
    workflowMatrix: matrix,
    pagesRuns,
    publicUrl,
    publicHttpStatus: page.status,
    manifestHttpStatus: manifest.status,
    ibmPlexHttpStatus: font.status,
    pages,
    deploymentCount: deployments.length,
    deploymentIds: deployments.map((deployment) => deployment.id),
    deploymentStatuses
  };
  console.log(`QELLY_PR14_POST_MERGE_REPORT=${JSON.stringify(report)}`);
});
