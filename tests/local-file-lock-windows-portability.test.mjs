import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isLocalFileLockContention } from '../src/platform/local-file-lock.mjs';

const temp = async () => mkdtemp(path.join(os.tmpdir(), 'qelly-lock-portability-'));

test('Windows sharing violations are contention only while the lock path exists', async () => {
  const dir = await temp();
  try {
    const lockPath = path.join(dir, 'state.json.lock');
    await writeFile(lockPath, 'held');
    assert.equal(await isLocalFileLockContention({ code: 'EPERM' }, lockPath, { platform: 'win32' }), true);
    assert.equal(await isLocalFileLockContention({ code: 'EACCES' }, lockPath, { platform: 'win32' }), true);
    await rm(lockPath, { force: true });
    assert.equal(await isLocalFileLockContention({ code: 'EPERM' }, lockPath, { platform: 'win32' }), false);
    assert.equal(await isLocalFileLockContention({ code: 'EACCES' }, lockPath, { platform: 'win32' }), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('exclusive-create contention remains portable without masking non-Windows permission errors', async () => {
  const dir = await temp();
  try {
    const lockPath = path.join(dir, 'state.json.lock');
    await writeFile(lockPath, 'held');
    assert.equal(await isLocalFileLockContention({ code: 'EEXIST' }, lockPath, { platform: 'linux' }), true);
    assert.equal(await isLocalFileLockContention({ code: 'EPERM' }, lockPath, { platform: 'linux' }), false);
    assert.equal(await isLocalFileLockContention({ code: 'EINVAL' }, lockPath, { platform: 'win32' }), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
