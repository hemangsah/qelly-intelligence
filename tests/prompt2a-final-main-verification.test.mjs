import test from 'node:test';
import assert from 'node:assert/strict';

const repository = 'hemangsah/qelly-intelligence';
const finalMain = '9cb98780893924ad26fbf4baaa9048e80a162b2c';
const publicUrl = 'https://hemangsah.github.io/qelly-intelligence/';
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'Qelly-Prompt2A-Final-Main-Verifier',
  'X-GitHub-Api-Version': '2022-11-28'
};

async function json(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return response.json();
}

async function text(url) {
  const response = await fetch(url, { headers: { 'User-Agent': headers['User-Agent'] }, signal: AbortSignal.timeout(30_000) });
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return { body: await response.text(), status: response.status, contentType: response.headers.get('content-type') };
}

test('exact Prompt 2A closeout main has successful push workflows and Pages deployment', async () => {
  const runsPayload = await json(`https://api.github.com/repos/${repository}/actions/runs?head_sha=${finalMain}&per_page=100`);
  const runs = runsPayload.workflow_runs.filter((run) => run.head_sha === finalMain && run.event === 'push');
  const required = ['Continuous Integration', 'Container Build', 'Production Foundation Services', 'CodeQL'];
  const matrix = required.map((name) => {
    const matches = runs.filter((run) => run.name === name).sort((a, b) => b.id - a.id);
    const run = matches[0] || null;
    return {
      name,
      runId: run?.id ?? null,
      status: run?.status ?? 'missing',
      conclusion: run?.conclusion ?? 'missing',
      headSha: run?.head_sha ?? null,
      url: run?.html_url ?? null
    };
  });
  assert.deepEqual(matrix.map((row) => row.conclusion), required.map(() => 'success'), JSON.stringify(matrix, null, 2));

  const deployments = await json(`https://api.github.com/repos/${repository}/deployments?sha=${finalMain}&environment=github-pages&per_page=20`);
  const deployment = deployments.find((item) => item.sha === finalMain);
  assert.ok(deployment, `No github-pages deployment found for ${finalMain}`);
  const statuses = await json(`https://api.github.com/repos/${repository}/deployments/${deployment.id}/statuses?per_page=20`);
  const status = statuses.find((item) => item.state === 'success');
  assert.ok(status, `No successful Pages status for deployment ${deployment.id}`);

  const home = await text(publicUrl);
  const manifest = await text(`${publicUrl}manifest.webmanifest`);
  assert.match(home.body, /Qelly|qelly/i);
  assert.match(manifest.body, /Qelly|qelly/i);

  const report = {
    result: 'passed',
    finalMain,
    workflowMatrix: matrix,
    pages: {
      deploymentId: deployment.id,
      statusId: status.id,
      state: status.state,
      environmentUrl: status.environment_url || publicUrl,
      publicUrl,
      homeHttp: home.status,
      manifestHttp: manifest.status
    },
    truth: 'public static/read-only visual preview; not a connected full production product'
  };
  console.log(`QELLY_PROMPT2A_FINAL_MAIN_REPORT=${JSON.stringify(report)}`);
});
