import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanRepository } from '../scripts/secret-scan.mjs';

test('repository secret scan accepts placeholders and CI fixtures', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qelly-secret-scan-safe-'));
  try {
    await writeFile(path.join(directory, '.env.example'), [
      'QELLY_SESSION_SECRET=replace-with-a-secret-manager',
      'DATABASE_URL=postgres://qelly:${POSTGRES_PASSWORD}@postgres:5432/qelly'
    ].join('\n'));
    const result = await scanRepository(directory);
    assert.deepEqual(result.findings, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('repository secret scan reports tokens and key files without exposing values', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qelly-secret-scan-block-'));
  try {
    const token = `${'gh'}${'p_'}abcdefghijklmnopqrstuvwxyz123456`;
    await writeFile(path.join(directory, 'config.txt'), `GITHUB_TOKEN=${token}\n`);
    await writeFile(path.join(directory, 'production.pem'), 'not-a-real-key\n');
    const result = await scanRepository(directory);
    assert.ok(result.findings.some((finding) => finding.rule === 'github-token'));
    assert.ok(result.findings.some((finding) => finding.rule === 'private-key-file'));
    assert.equal(JSON.stringify(result).includes(token), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
